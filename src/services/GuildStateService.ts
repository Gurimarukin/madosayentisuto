import { Guild, Role } from 'discord.js'
import { apply, readonlyMap } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'

import { GuildId } from '../models/GuildId'
import { Calls } from '../models/guildState/Calls'
import { GuildState } from '../models/guildState/GuildState'
import { GuildStateDb } from '../models/guildState/GuildStateDb'
import { StaticCalls } from '../models/guildState/StaticCalls'
import { GuildStatePersistence } from '../persistence/GuildStatePersistence'
import { ChannelUtils } from '../utils/ChannelUtils'
import { Future, Maybe } from '../utils/fp'
import { DiscordConnector } from './DiscordConnector'

export type GuildStateService = ReturnType<typeof GuildStateService>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const GuildStateService = (
  guildStatePersistence: GuildStatePersistence,
  discord: DiscordConnector,
) => {
  const cache: ReadonlyMap<GuildId, GuildState> = readonlyMap.empty

  return {
    findAll: guildStatePersistence.findAll,

    // setCalls: (guild: Guild, calls: Calls): Future<boolean> =>
    //   set(guild, GuildState.Lens.calls, Maybe.some(StaticCalls.fromCalls(calls))),

    getCalls: (guild: Guild): Future<Maybe<Calls>> => get(guild, GuildState.Lens.calls.get),

    // setDefaultRole: (guild: Guild, role: Role): Future<boolean> =>
    //   set(guild, GuildState.Lens.defaultRole, Maybe.some(TSnowflake.wrap(role.id))),

    getDefaultRole: (guild: Guild): Future<Maybe<Role>> =>
      get(guild, GuildState.Lens.defaultRole.get),
  }

  // function set<A>(guild: Guild, lens: Lens<GuildState, A>, a: A): Future<boolean> {
  //   const guildId = GuildId.wrap(guild.id)
  //   return pipe(
  //     guildStatePersistence.find(guildId),
  //     Future.map(Maybe.getOrElse(() => GuildState.empty(guildId))),
  //     Future.map(lens.set(a)),
  //     Future.chain(s => guildStatePersistence.upsert(guildId, s)),
  //   )
  // }

  function get<A>(guild: Guild, getter: (state: GuildState) => A): Future<A> {
    return pipe(
      cache,
      readonlyMap.lookup(GuildId.Eq)(GuildId.wrap(guild.id)),
      Maybe.fold(
        () => pipe(addGuildToCacheFromDb(guild), Future.map(getter)),
        flow(getter, Future.right),
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
              (res): GuildState => ({ ...res, id: guildId, subscriptions: readonlyMap.empty }),
            ),
          ),
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
