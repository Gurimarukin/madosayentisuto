import { Guild, Role } from 'discord.js'
import { apply } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'

import { GuildId } from '../models/GuildId'
import { Calls } from '../models/guildState/Calls'
import { GuildState } from '../models/guildState/GuildState'
import { GuildStatePersistence } from '../persistence/GuildStatePersistence'
import { ChannelUtils } from '../utils/ChannelUtils'
import { Future, Maybe } from '../utils/fp'
import { DiscordConnector } from './DiscordConnector'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const GuildStateService = (
  guildStatePersistence: GuildStatePersistence,
  discord: DiscordConnector,
) => {
  return {
    findAll: guildStatePersistence.findAll,

    // setCalls: (guild: Guild, calls: Calls): Future<boolean> =>
    //   set(guild, GuildState.Lens.calls, Maybe.some(StaticCalls.fromCalls(calls))),

    getCalls: (guild: Guild): Future<Maybe<Calls>> =>
      get(
        guild,
        s => s.calls,
        ({ message, channel, role }) =>
          pipe(
            Future.Do,
            Future.bind('message', () => DiscordConnector.fetchMessage(guild, message)),
            Future.bind('channel', () =>
              pipe(
                discord.fetchChannel(channel),
                Future.map(Maybe.filter(ChannelUtils.isTextChannel)),
              ),
            ),
            Future.bind('role', () => DiscordConnector.fetchRole(guild, role)),
            Future.map(apply.sequenceS(Maybe.Apply)),
          ),
      ),

    // setDefaultRole: (guild: Guild, role: Role): Future<boolean> =>
    //   set(guild, GuildState.Lens.defaultRole, Maybe.some(TSnowflake.wrap(role.id))),

    getDefaultRole: (guild: Guild): Future<Maybe<Role>> =>
      get(
        guild,
        s => s.defaultRole,
        id => DiscordConnector.fetchRole(guild, id),
      ),
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

  function get<A, B>(
    guild: Guild,
    getter: (state: GuildState) => Maybe<A>,
    fetch: (a: A) => Future<Maybe<B>>,
  ): Future<Maybe<B>> {
    return pipe(
      guildStatePersistence.find(GuildId.wrap(guild.id)),
      Future.chain(
        flow(
          Maybe.chain(getter),
          Maybe.fold(() => Future.right(Maybe.none), fetch),
        ),
      ),
    )
  }
}

export type GuildStateService = ReturnType<typeof GuildStateService>
