import type { Guild, Message, Role, TextChannel } from 'discord.js'
import { apply, readonlyMap } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'
import type { Lens } from 'monocle-ts/Lens'

import type { ChannelId } from '../../shared/models/ChannelId'
import type { MessageId } from '../../shared/models/MessageId'
import { ServerToClientEvent } from '../../shared/models/event/ServerToClientEvent'
import { GuildId } from '../../shared/models/guild/GuildId'
import type { TSubject } from '../../shared/models/rx/TSubject'
import type { NotUsed } from '../../shared/utils/fp'
import { Future, IO, List, Maybe } from '../../shared/utils/fp'
import { futureMaybe } from '../../shared/utils/futureMaybe'

import { AudioSubscription } from '../helpers/AudioSubscription'
import { DiscordConnector } from '../helpers/DiscordConnector'
import type { YtDlp } from '../helpers/YtDlp'
import { OldAndNewState } from '../models/OldAndNewState'
import type { Calls } from '../models/guildState/Calls'
import { GuildState } from '../models/guildState/GuildState'
import type { CallsDb } from '../models/guildState/db/CallsDb'
import { GuildStateDb } from '../models/guildState/db/GuildStateDb'
import type { LoggerGetter } from '../models/logger/LoggerObservable'
import type { GuildStatePersistence } from '../persistence/GuildStatePersistence'
import type { GuildSendableChannel } from '../utils/ChannelUtils'
import { ChannelUtils } from '../utils/ChannelUtils'
import { LogUtils } from '../utils/LogUtils'
import { getOnError } from '../utils/getOnError'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LensInner<A extends Lens<any, any>> = A extends Lens<any, infer B> ? B : never
type GuildStateLens = typeof GuildState.Lens
type WithouId<A> = Exclude<A, 'id'>

export type GuildStateService = ReturnType<typeof GuildStateService>

export const GuildStateService = (
  Logger: LoggerGetter,
  discord: DiscordConnector,
  ytDlp: YtDlp,
  guildStatePersistence: GuildStatePersistence,
  serverToClientEventSubject: TSubject<ServerToClientEvent>,
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
) => {
  const logger = Logger('GuildStateService')

  const cache = new Map<GuildId, GuildState>()

  const listAllItsFridayChannels: Future<List<GuildSendableChannel>> = pipe(
    guildStatePersistence.listAllItsFridayChannels(),
    Future.chain(List.traverse(Future.ApplicativePar)(discord.fetchChannel)),
    Future.map(flow(List.compact, List.filter(ChannelUtils.isGuildSendable))),
  )

  return {
    getState: (guild: Guild): Future<GuildState> => getShouldLoadFromDb(guild),

    setCalls: (guild: Guild, calls: Maybe<Calls>): Future<GuildState> =>
      setLens(guild, 'calls', calls),

    getCalls: (guild: Guild): Future<Maybe<Calls>> => get(guild, 'calls'),

    setDefaultRole: (guild: Guild, role: Maybe<Role>): Future<GuildState> =>
      setLens(guild, 'defaultRole', role),

    getDefaultRole: (guild: Guild): Future<Maybe<Role>> => get(guild, 'defaultRole'),

    listAllItsFridayChannels,

    setItsFridayChannel: (guild: Guild, channel: Maybe<TextChannel>): Future<GuildState> =>
      setLens(guild, 'itsFridayChannel', channel),

    getBirthdayChannel: (guild: Guild): Future<Maybe<GuildSendableChannel>> =>
      get(guild, 'birthdayChannel'),

    setBirthdayChannel: (guild: Guild, channel: Maybe<TextChannel>): Future<GuildState> =>
      setLens(guild, 'birthdayChannel', channel),

    getTheQuestMessage: (guild: Guild): Future<Maybe<Message<true>>> =>
      get(guild, 'theQuestMessage'),

    setTheQuestMessage: (guild: Guild, message: Maybe<Message<true>>): Future<GuildState> =>
      setLens(guild, 'theQuestMessage', message),

    getSubscription: (guild: Guild): Future<AudioSubscription> =>
      pipe(
        get(guild, 'subscription'),
        Future.fromIOEither,
        Future.map(Maybe.flatten),
        futureMaybe.getOrElse(() =>
          Future.fromIOEither(
            AudioSubscription.of(Logger, ytDlp, serverToClientEventSubject, guild),
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

    return pipe(
      shouldUpsert ? cacheUpdateAtAndUpsertDb(guild, update) : cacheUpdateAt(guild, update),
      Future.chainFirstIOEitherK(({ oldState, newState }) =>
        GuildState.Eq.equals(oldState, newState)
          ? IO.notUsed
          : serverToClientEventSubject.next(ServerToClientEvent.guildStateUpdated),
      ),
      Future.map(({ newState }) => newState),
    )
  }

  function cacheUpdateAtAndUpsertDb(
    guild: Guild,
    update: (state: GuildState) => GuildState,
  ): Future<OldAndNewState<GuildState>> {
    return pipe(
      cacheUpdateAt(guild, update),
      Future.chainFirstIOK(({ newState }) => {
        const log = LogUtils.pretty(logger, guild)

        // upsert new state, but don't wait until it's done; immediatly return state from cache
        return pipe(
          guildStatePersistence.upsert(GuildStateDb.fromGuildState(newState)),
          Future.chainIOEitherK(success => (success ? IO.notUsed : logError())),
          Future.orElseIOEitherK(e => logError('-', e)),
          IO.runFuture(getOnError(logger)),
        )

        function logError(...u: List<unknown>): IO<NotUsed> {
          return log.error('Failed to upsert state', ...u)
        }
      }),
    )
  }

  function cacheUpdateAt(
    guild: Guild,
    update: (state: GuildState) => GuildState,
  ): Future<OldAndNewState<GuildState>> {
    return pipe(
      getShouldLoadFromDb(guild),
      Future.map(oldState => OldAndNewState(oldState, update(oldState))),
      Future.chainFirstIOEitherK(({ newState }) => cacheSet(GuildId.fromGuild(guild), newState)),
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
        () => Future.successful(GuildState.empty(guildId)),
        flow(
          fetchDbProperties(guild),
          Future.map(
            ({
              calls,
              defaultRole,
              itsFridayChannel,
              birthdayChannel,
              theQuestMessage,
            }): GuildState => ({
              id: guildId,
              calls,
              defaultRole,
              itsFridayChannel,
              birthdayChannel,
              theQuestMessage,
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
    return ({ calls, defaultRole, itsFridayChannel, birthdayChannel, theQuestMessage }) =>
      apply.sequenceS(Future.ApplyPar)({
        calls: chainFutureT(calls, fetchCalls(guild)),
        defaultRole: chainFutureT(defaultRole, id => DiscordConnector.fetchRole(guild, id)),
        itsFridayChannel: chainFutureT(itsFridayChannel, fetchGuildSendableChannel),
        birthdayChannel: chainFutureT(birthdayChannel, fetchGuildSendableChannel),
        theQuestMessage: chainFutureT(theQuestMessage, fetchMessage(guild)),
      })
  }

  function fetchCalls(guild: Guild): (calls: CallsDb) => Future<Maybe<Calls>> {
    return ({ channel, role }) =>
      apply.sequenceS(futureMaybe.ApplyPar)({
        channel: fetchGuildSendableChannel(channel),
        role: DiscordConnector.fetchRole(guild, role),
      })
  }

  function fetchGuildSendableChannel(channelId: ChannelId): Future<Maybe<GuildSendableChannel>> {
    return pipe(
      discord.fetchChannel(channelId),
      Future.map(Maybe.filter(ChannelUtils.isGuildSendable)),
    )
  }

  function fetchMessage(guild: Guild): (messageId: MessageId) => Future<Maybe<Message<true>>> {
    return messageId => DiscordConnector.fetchMessage(guild, messageId)
  }
}

const isDbKey = (key: WithouId<keyof GuildState>): key is WithouId<keyof GuildStateDb> =>
  pipe(
    GuildStateDb.keys,
    List.exists(k => k === key),
  )

const chainFutureT = <A, B>(fa: Maybe<A>, f: (a: A) => Future<Maybe<B>>): Future<Maybe<B>> =>
  pipe(fa, futureMaybe.fromOption, futureMaybe.chain(f))
