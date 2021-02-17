import { Guild, Role } from 'discord.js'
import { Lens } from 'monocle-ts'

import { DiscordConnector } from './DiscordConnector'
import { PartialLogger } from './Logger'
import { GuildId } from '../models/GuildId'
import { Calls } from '../models/guildState/Calls'
import { GuildState } from '../models/guildState/GuildState'
import { StaticCalls } from '../models/guildState/StaticCalls'
import { TSnowflake } from '../models/TSnowflake'
import { GuildStatePersistence } from '../persistence/GuildStatePersistence'
import { pipe, Maybe, Future, flow, Do } from '../utils/fp'
import { ChannelUtils } from '../utils/ChannelUtils'

export const GuildStateService = (
  Logger: PartialLogger,
  guildStatePersistence: GuildStatePersistence,
  discord: DiscordConnector,
) => {
  const _logger = Logger('GuildStateService')

  return {
    setCalls: (guild: Guild, calls: Calls): Future<boolean> =>
      set(guild, GuildState.Lens.calls, Maybe.some(StaticCalls.fromCalls(calls))),

    getCalls: (guild: Guild): Future<Maybe<Calls>> =>
      get(
        guild,
        _ => _.calls,
        ({ message, channel, role }) =>
          Do(Future.taskEitherSeq)
            .bind('message', discord.fetchMessage(guild, message))
            .bind(
              'channel',
              pipe(discord.fetchChannel(channel), Future.map(Maybe.filter(ChannelUtils.isText))),
            )
            .bind('role', discord.fetchRole(guild, role))
            .return(({ message, channel, role }) =>
              Do(Maybe.option)
                .bind('message', message)
                .bind('channel', channel)
                .bind('role', role)
                .done(),
            ),
      ),

    setDefaultRole: (guild: Guild, role: Role): Future<boolean> =>
      set(guild, GuildState.Lens.defaultRole, Maybe.some(TSnowflake.wrap(role.id))),

    getDefaultRole: (guild: Guild): Future<Maybe<Role>> =>
      get(
        guild,
        _ => _.defaultRole,
        _ => discord.fetchRole(guild, _),
      ),
  }

  function set<A>(guild: Guild, lens: Lens<GuildState, A>, a: A): Future<boolean> {
    const guildId = GuildId.wrap(guild.id)
    return pipe(
      guildStatePersistence.find(guildId),
      Future.map(Maybe.getOrElse(() => GuildState.empty(guildId))),
      Future.map(lens.set(a)),
      Future.chain(_ => guildStatePersistence.upsert(guildId, _)),
    )
  }

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
