import { Guild, Role } from 'discord.js'
import { apply, readonlyMap } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'
import { Lens as MonocleLens } from 'monocle-ts'

import { GuildId } from '../models/GuildId'
import { Calls } from '../models/guildState/Calls'
import { GuildState } from '../models/guildState/GuildState'
import { GuildStateDb } from '../models/guildState/GuildStateDb'
import { StaticCalls } from '../models/guildState/StaticCalls'
import { TSnowflake } from '../models/TSnowflake'
import { GuildStatePersistence } from '../persistence/GuildStatePersistence'
import { ChannelUtils } from '../utils/ChannelUtils'
import { Future, IO, List, Maybe } from '../utils/fp'
import { LogUtils } from '../utils/LogUtils'
import { DiscordConnector } from './DiscordConnector'
import { PartialLogger } from './Logger'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LensInner<A extends MonocleLens<any, any>> = A extends MonocleLens<any, infer B> ? B : never

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

    getCalls: (guild: Guild): Future<Maybe<Calls>> =>
      pipe(get(guild), Future.map(GuildState.Lens.calls.get)),

    setDefaultRole: (guild: Guild, role: Role): IO<GuildState> =>
      setLens(guild, 'defaultRole', Maybe.some(role)),

    getDefaultRole: (guild: Guild): Future<Maybe<Role>> =>
      pipe(get(guild), Future.map(GuildState.Lens.defaultRole.get)),

    setSubscriptions: (
      guild: Guild,
      subscriptions: ReadonlyMap<TSnowflake, unknown>,
    ): IO<GuildState> => setLens(guild, 'subscriptions', subscriptions),

    getSubscriptions: (guild: Guild): Future<ReadonlyMap<TSnowflake, unknown>> =>
      pipe(get(guild), Future.map(GuildState.Lens.subscriptions.get)),
  }

  function cacheSet(guildId: GuildId, state: GuildState): IO<ReadonlyMap<GuildId, GuildState>> {
    return IO.fromIO(() => cache.set(guildId, state))
  }

  type GuildStateLens = typeof GuildState.Lens

  function setLens<K extends Exclude<keyof GuildState, 'id'>>(
    guild: Guild,
    lensKey: K,
    a: LensInner<GuildStateLens[K]>,
  ): IO<GuildState> {
    // check if we are updating a key that exists in GuildStateDb
    const shouldUpsert = pipe(
      GuildStateDb.keys,
      List.exists(k => k === lensKey),
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update = GuildState.Lens[lensKey].set(a as any) // I know what I'm doing
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
        // upsert new state, but don't wait until it's done; immediatly return state from cache
        return pipe(
          LogUtils.withGuild(logger, 'debug', guild)('Upserting state'),
          Future.fromIOEither,
          Future.chain(() =>
            guildStatePersistence.upsert(guildId, GuildStateDb.fromGuildState(state)),
          ),
          Future.chain(success => (success ? Future.unit : error())),
          Future.recover(e => error('-', e)),
          IO.runFuture,
          IO.map(() => state),
        )

        function error(...u: List<unknown>): Future<void> {
          return Future.fromIOEither(
            LogUtils.withGuild(logger, 'error', guild)('Failed to upsert state', ...u),
          )
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
    return pipe(
      cacheSet(guildId, update(state)),
      IO.map(() => state),
    )
  }

  function get(guild: Guild): Future<GuildState> {
    return pipe(
      cache,
      readonlyMap.lookup(GuildId.Eq)(GuildId.wrap(guild.id)),
      Maybe.fold(
        () =>
          pipe(
            LogUtils.withGuild(
              logger,
              'debug',
              guild,
            )("State wasn't found in cache, loading it from db"),
            Future.fromIOEither,
            Future.chain(() => addGuildToCacheFromDb(guild)),
          ),
        Future.right,
      ),
    )
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
                subscriptions: readonlyMap.empty,
              }),
            ),
          ),
        ),
      ),
      Future.chain(state =>
        pipe(
          cacheSet(guildId, state),
          Future.fromIOEither,
          Future.map(() => state),
        ),
      ),
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

  function fetchCalls(guild: Guild): (calls: StaticCalls) => Future<Maybe<Calls>> {
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

const chainFutureT = <A, B>(fa: Maybe<A>, f: (a: A) => Future<Maybe<B>>): Future<Maybe<B>> =>
  pipe(
    fa,
    Maybe.fold(() => Future.right(Maybe.none), f),
  )
