import type { Guild, Role, TextChannel } from 'discord.js'
import { apply, readonlyMap } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'
import type { Lens } from 'monocle-ts/Lens'

import type { ChannelId } from '../../shared/models/ChannelId'
import { GuildId } from '../../shared/models/guild/GuildId'
import { Future, IO, List, Maybe } from '../../shared/utils/fp'
import { futureMaybe } from '../../shared/utils/futureMaybe'

import { DiscordConnector } from '../helpers/DiscordConnector'
import { MusicSubscription } from '../helpers/MusicSubscription'
import type { YtDlp } from '../helpers/YtDlp'
import type { Calls } from '../models/guildState/Calls'
import { GuildState } from '../models/guildState/GuildState'
import type { CallsDb } from '../models/guildState/db/CallsDb'
import { GuildStateDb } from '../models/guildState/db/GuildStateDb'
import type { LoggerGetter } from '../models/logger/LoggerGetter'
import type { GuildStatePersistence } from '../persistence/GuildStatePersistence'
import { ChannelUtils } from '../utils/ChannelUtils'
import { LogUtils } from '../utils/LogUtils'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LensInner<A extends Lens<any, any>> = A extends Lens<any, infer B> ? B : never
type GuildStateLens = typeof GuildState.Lens
type WithouId<A> = Exclude<A, 'id'>

export type GuildStateService = ReturnType<typeof GuildStateService>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const GuildStateService = (
  Logger: LoggerGetter,
  discord: DiscordConnector,
  ytDlp: YtDlp,
  guildStatePersistence: GuildStatePersistence,
) => {
  const logger = Logger('GuildStateService')

  const cache = new Map<GuildId, GuildState>()

  const listAllItsFridayChannels = pipe(
    guildStatePersistence.listAllItsFridayChannels(),
    Future.chain(Future.traverseArray(itsFridayChannel => discord.fetchChannel(itsFridayChannel))),
    Future.map(flow(List.compact, List.filter(ChannelUtils.isTextChannel))),
  )

  return {
    getState: (guild: Guild): Future<GuildState> => getShouldLoadFromDb(guild),

    setCalls: (guild: Guild, calls: Calls): Future<GuildState> =>
      setLens(guild, 'calls', Maybe.some(calls)),

    getCalls: (guild: Guild): Future<Maybe<Calls>> => get(guild, 'calls'),

    setDefaultRole: (guild: Guild, role: Role): Future<GuildState> =>
      setLens(guild, 'defaultRole', Maybe.some(role)),

    getDefaultRole: (guild: Guild): Future<Maybe<Role>> => get(guild, 'defaultRole'),

    listAllItsFridayChannels,

    setItsFridayChannel: (guild: Guild, channel: TextChannel): Future<GuildState> =>
      setLens(guild, 'itsFridayChannel', Maybe.some(channel)),

    getBirthdayChannel: (guild: Guild): Future<Maybe<TextChannel>> => get(guild, 'birthdayChannel'),

    setBirthdayChannel: (guild: Guild, channel: TextChannel): Future<GuildState> =>
      setLens(guild, 'birthdayChannel', Maybe.some(channel)),

    getSubscription: (guild: Guild): Future<MusicSubscription> =>
      pipe(
        get(guild, 'subscription'),
        Future.fromIOEither,
        Future.map(
          flow(
            Maybe.flatten,
            Maybe.getOrElse(() => MusicSubscription(Logger, ytDlp, guild)),
          ),
        ),
        Future.chainFirst(subscription => setLens(guild, 'subscription', Maybe.some(subscription))),
      ),
  }

  function cacheSet(guildId: GuildId, state: GuildState): IO<ReadonlyMap<GuildId, GuildState>> {
    return IO.fromIO(() => cache.set(guildId, state))
  }

  function setLens<K extends Exclude<keyof GuildState, 'id'>>(
    guild: Guild,
    key: K,
    a: LensInner<GuildStateLens[K]>,
  ): Future<GuildState> {
    // check if we are updating a key that exists in GuildStateDb
    const shouldUpsert = isDbKey(key)

    type Setter = (a_: LensInner<GuildStateLens[K]>) => (s: GuildState) => GuildState
    const update = (GuildState.Lens[key].set as Setter)(a)

    return shouldUpsert ? cacheUpdateAtAndUpsertDb(guild, update) : cacheUpdateAt(guild, update)
  }

  function cacheUpdateAtAndUpsertDb(
    guild: Guild,
    update: (state: GuildState) => GuildState,
  ): Future<GuildState> {
    return pipe(
      cacheUpdateAt(guild, update),
      Future.chainFirstIOEitherK(newState => {
        const log = LogUtils.pretty(logger, guild)

        // upsert new state, but don't wait until it's done; immediatly return state from cache
        return pipe(
          guildStatePersistence.upsert(GuildStateDb.fromGuildState(newState)),
          Future.chainIOEitherK(success => (success ? IO.unit : logError())),
          Future.orElseIOEitherK(e => logError('-', e)),
          IO.runFutureUnsafe,
        )

        function logError(...u: List<unknown>): IO<void> {
          return log.error('Failed to upsert state', ...u)
        }
      }),
    )
  }

  function cacheUpdateAt(
    guild: Guild,
    update: (state: GuildState) => GuildState,
  ): Future<GuildState> {
    return pipe(
      getShouldLoadFromDb(guild),
      Future.map(update),
      Future.chainFirstIOEitherK(newState => cacheSet(GuildId.fromGuild(guild), newState)),
    )
  }

  function get<K extends Exclude<keyof GuildState, 'id'>>(
    guild: Guild,
    key: K,
  ): K extends WithouId<keyof GuildStateDb>
    ? Future<LensInner<GuildStateLens[K]>>
    : IO<Maybe<LensInner<GuildStateLens[K]>>> {
    const getter = GuildState.Lens[key].get as (s: GuildState) => LensInner<GuildStateLens[K]>

    // check if we are getting a key that exists in GuildStateDb
    const shouldLoadFromDb = isDbKey(key)

    if (shouldLoadFromDb) {
      const res: Future<LensInner<GuildStateLens[K]>> = pipe(
        getShouldLoadFromDb(guild),
        Future.map(getter),
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return res as any // I know what I'm doing
    }

    const guildId = GuildId.fromGuild(guild)
    const res: IO<Maybe<LensInner<GuildStateLens[K]>>> = pipe(
      getFromCache(guildId),
      IO.map(Maybe.map(getter)),
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return res as any // I know what I'm doing
  }

  function getFromCache(guildId: GuildId): IO<Maybe<GuildState>> {
    return IO.fromIO(() => readonlyMap.lookup(GuildId.Eq)(guildId, cache))
  }

  function getShouldLoadFromDb(guild: Guild): Future<GuildState> {
    const guildId = GuildId.fromGuild(guild)
    return pipe(
      getFromCache(guildId),
      Future.fromIOEither,
      futureMaybe.getOrElse(() => addGuildToCacheFromDb(guild)),
    )
  }

  function addGuildToCacheFromDb(guild: Guild): Future<GuildState> {
    const guildId = GuildId.fromGuild(guild)
    return pipe(
      guildStatePersistence.find(guildId),
      futureMaybe.matchE(
        () => Future.right(GuildState.empty(guildId)),
        flow(
          fetchDbProperties(guild),
          Future.map(
            ({ calls, defaultRole, itsFridayChannel, birthdayChannel }): GuildState => ({
              id: guildId,
              calls,
              defaultRole,
              itsFridayChannel,
              birthdayChannel,
              subscription: Maybe.none,
            }),
          ),
        ),
      ),
      Future.chainFirstIOEitherK(state => cacheSet(guildId, state)),
    )
  }

  function fetchDbProperties(
    guild: Guild,
  ): (state: GuildStateDb) => Future<Pick<GuildState, Exclude<keyof GuildStateDb, 'id'>>> {
    return ({ calls, defaultRole, itsFridayChannel, birthdayChannel }) =>
      apply.sequenceS(Future.ApplyPar)({
        calls: chainFutureT(calls, fetchCalls(guild)),
        defaultRole: chainFutureT(defaultRole, id => DiscordConnector.fetchRole(guild, id)),
        itsFridayChannel: chainFutureT(itsFridayChannel, fetchTextChannel),
        birthdayChannel: chainFutureT(birthdayChannel, fetchTextChannel),
      })
  }

  function fetchCalls(guild: Guild): (calls: CallsDb) => Future<Maybe<Calls>> {
    return ({ message, channel, role }) =>
      apply.sequenceS(futureMaybe.ApplyPar)({
        message: DiscordConnector.fetchMessage(guild, message),
        channel: fetchTextChannel(channel),
        role: DiscordConnector.fetchRole(guild, role),
      })
  }

  function fetchTextChannel(channelId: ChannelId): Future<Maybe<TextChannel>> {
    return pipe(
      discord.fetchChannel(channelId),
      Future.map(Maybe.filter(ChannelUtils.isTextChannel)),
    )
  }
}

const isDbKey = (key: WithouId<keyof GuildState>): key is WithouId<keyof GuildStateDb> =>
  pipe(
    GuildStateDb.keys,
    List.exists(k => k === key),
  )

const chainFutureT = <A, B>(fa: Maybe<A>, f: (a: A) => Future<Maybe<B>>): Future<Maybe<B>> =>
  pipe(fa, futureMaybe.fromOption, futureMaybe.chain(f))
