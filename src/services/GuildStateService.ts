import { Guild, Role } from 'discord.js'
import { apply, readonlyMap } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'
import { Lens as MonocleLens } from 'monocle-ts'

import { GuildId } from '../models/GuildId'
import { Calls } from '../models/guildState/Calls'
import { CallsDb } from '../models/guildState/db/CallsDb'
import { GuildStateDb } from '../models/guildState/db/GuildStateDb'
import { GuildState } from '../models/guildState/GuildState'
import { MusicSubscription } from '../models/guildState/MusicSubscription'
import { GuildStatePersistence } from '../persistence/GuildStatePersistence'
import { ChannelUtils } from '../utils/ChannelUtils'
import { Future, IO, List, Maybe } from '../utils/fp'
import { LogUtils } from '../utils/LogUtils'
import { DiscordConnector } from './DiscordConnector'
import { PartialLogger } from './Logger'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LensInner<A extends MonocleLens<any, any>> = A extends MonocleLens<any, infer B> ? B : never
type GuildStateLens = typeof GuildState.Lens
type WithouId<A> = Exclude<A, 'id'>

export type GuildStateService = ReturnType<typeof GuildStateService>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const GuildStateService = (
  Logger: PartialLogger,
  discord: DiscordConnector,
  guildStatePersistence: GuildStatePersistence,
) => {
  const logger = Logger('GuildStateService')

  const cache = new Map<GuildId, GuildState>()

  return {
    findAll: guildStatePersistence.findAll,

    setCalls: (guild: Guild, calls: Calls): IO<GuildState> =>
      setLens(guild, 'calls', Maybe.some(calls)),

    getCalls: (guild: Guild): Future<Maybe<Calls>> => get(guild, 'calls'),

    setDefaultRole: (guild: Guild, role: Role): IO<GuildState> =>
      setLens(guild, 'defaultRole', Maybe.some(role)),

    getDefaultRole: (guild: Guild): Future<Maybe<Role>> => get(guild, 'defaultRole'),

    setSubscription: (guild: Guild, subscription: MusicSubscription): IO<GuildState> =>
      setLens(guild, 'subscription', Maybe.some(subscription)),

    getSubscription: (guild: Guild): IO<Maybe<MusicSubscription>> =>
      pipe(get(guild, 'subscription'), IO.map(Maybe.flatten)),
  }

  function cacheSet(guildId: GuildId, state: GuildState): IO<ReadonlyMap<GuildId, GuildState>> {
    return IO.fromIO(() => cache.set(guildId, state))
  }

  function setLens<K extends Exclude<keyof GuildState, 'id'>>(
    guild: Guild,
    key: K,
    a: LensInner<GuildStateLens[K]>,
  ): IO<GuildState> {
    // check if we are updating a key that exists in GuildStateDb
    const shouldUpsert = isDbKey(key)

    type Setter = (a_: LensInner<GuildStateLens[K]>) => (s: GuildState) => GuildState
    const update = (GuildState.Lens[key].set as Setter)(a)

    return shouldUpsert
      ? cacheUpdateAtAndUpsertDb(guild, update)
      : cacheUpdateAt(GuildId.wrap(guild.id), update)
  }

  function cacheUpdateAtAndUpsertDb(
    guild: Guild,
    update: (state: GuildState) => GuildState,
  ): IO<GuildState> {
    const guildId = GuildId.wrap(guild.id)

    return pipe(
      cacheUpdateAt(guildId, update),
      IO.chain(state => {
        const log = LogUtils.pretty(logger, guild)

        // upsert new state, but don't wait until it's done; immediatly return state from cache
        return pipe(
          log('debug', 'Upserting state'),
          Future.fromIOEither,
          Future.chain(() =>
            guildStatePersistence.upsert(guildId, GuildStateDb.fromGuildState(state)),
          ),
          Future.chain(success => (success ? Future.unit : error())),
          Future.orElse(e => error('-', e)),
          IO.runFuture,
          IO.map(() => state),
        )

        function error(...u: List<unknown>): Future<void> {
          return Future.fromIOEither(log('error', 'Failed to upsert state', ...u))
        }
      }),
    )
  }

  function cacheUpdateAt(
    guildId: GuildId,
    update: (state: GuildState) => GuildState,
  ): IO<GuildState> {
    const state = pipe(
      cache,
      readonlyMap.lookup(GuildId.Eq)(guildId),
      Maybe.getOrElse(() => GuildState.empty(guildId)),
    )
    const updated = update(state)
    return pipe(
      cacheSet(guildId, updated),
      IO.map(() => updated),
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
    const fromCache = pipe(
      IO.fromIO(() => readonlyMap.lookup(GuildId.Eq)(GuildId.wrap(guild.id), cache)),
    )

    if (shouldLoadFromDb) {
      const res: Future<LensInner<GuildStateLens[K]>> = pipe(
        fromCache,
        Future.fromIOEither,
        Future.chain(
          Maybe.fold(
            () =>
              pipe(
                LogUtils.pretty(logger, guild)(
                  'debug',
                  "State wasn't found in cache, loading it from db",
                ),
                Future.fromIOEither,
                Future.chain(() => addGuildToCacheFromDb(guild)),
              ),
            Future.right,
          ),
        ),
        Future.map(getter),
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return res as any // I know what I'm doing
    }

    const res: IO<Maybe<LensInner<GuildStateLens[K]>>> = pipe(fromCache, IO.map(Maybe.map(getter)))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return res as any // I know what I'm doing
  }

  function addGuildToCacheFromDb(guild: Guild): Future<GuildState> {
    const guildId = GuildId.wrap(guild.id)
    return pipe(
      guildStatePersistence.find(guildId),
      Future.chain(
        Maybe.fold(
          () => Future.right(GuildState.empty(guildId)),
          flow(
            fetchCallsAndDefaultRole(guild),
            Future.map(
              ({ calls, defaultRole }): GuildState => ({
                id: guildId,
                calls,
                defaultRole,
                subscription: Maybe.none,
              }),
            ),
          ),
        ),
      ),
      Future.chainFirst(state => pipe(cacheSet(guildId, state), Future.fromIOEither)),
    )
  }

  function fetchCallsAndDefaultRole(
    guild: Guild,
  ): (state: GuildStateDb) => Future<Pick<GuildState, 'calls' | 'defaultRole'>> {
    return ({ calls, defaultRole }) =>
      apply.sequenceS(Future.ApplyPar)({
        calls: chainFutureT(calls, fetchCalls(guild)),
        defaultRole: chainFutureT(defaultRole, id => DiscordConnector.fetchRole(guild, id)),
      })
  }

  function fetchCalls(guild: Guild): (calls: CallsDb) => Future<Maybe<Calls>> {
    return ({ message, channel, role }) =>
      pipe(
        apply.sequenceS(Future.ApplyPar)({
          message: DiscordConnector.fetchMessage(guild, message),
          channel: pipe(
            discord.fetchChannel(channel),
            Future.map(Maybe.filter(ChannelUtils.isTextChannel)),
          ),
          role: DiscordConnector.fetchRole(guild, role),
        }),
        Future.map(apply.sequenceS(Maybe.Apply)), // return Some only if all are Some
      )
  }
}

const isDbKey = (key: WithouId<keyof GuildState>): key is WithouId<keyof GuildStateDb> =>
  pipe(
    GuildStateDb.keys,
    List.exists(k => k === key),
  )

const chainFutureT = <A, B>(fa: Maybe<A>, f: (a: A) => Future<Maybe<B>>): Future<Maybe<B>> =>
  pipe(
    fa,
    Maybe.fold(() => Future.right(Maybe.none), f),
  )
