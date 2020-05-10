import { Guild, Role, Message } from 'discord.js'
import { Lens } from 'monocle-ts'

import { DiscordConnector } from './DiscordConnector'
import { PartialLogger } from './Logger'
import { GuildId } from '../models/GuildId'
import { GuildState } from '../models/GuildState'
import { TSnowflake } from '../models/TSnowflake'
import { GuildStatePersistence } from '../persistence/GuildStatePersistence'
import { pipe, Maybe, Future, flow } from '../utils/fp'

export interface GuildStateService {
  setCallsMessage: (guild: Guild, message: Message) => Future<boolean>
  getCallsMessage: (guild: Guild) => Future<Maybe<Message>>
  setDefaultRole: (guild: Guild, role: Role) => Future<boolean>
  getDefaultRole: (guild: Guild) => Future<Maybe<Role>>
}

export const GuildStateService = (
  Logger: PartialLogger,
  guildStatePersistence: GuildStatePersistence,
  discord: DiscordConnector
): Future<GuildStateService> =>
  pipe(
    guildStatePersistence.findAll(),
    Future.map(_guilds => {
      const _logger = Logger('GuildStateService')

      return {
        setCallsMessage: (guild: Guild, message: Message): Future<boolean> =>
          set(guild, GuildState.Lens.callsMessage, Maybe.some(TSnowflake.wrap(message.id))),

        getCallsMessage: (guild: Guild): Future<Maybe<Message>> =>
          get(
            guild,
            _ => _.callsMessage,
            _ => discord.fetchMessage(guild, _)
          ),

        setDefaultRole: (guild: Guild, role: Role): Future<boolean> =>
          set(guild, GuildState.Lens.defaultRole, Maybe.some(TSnowflake.wrap(role.id))),

        getDefaultRole: (guild: Guild): Future<Maybe<Role>> =>
          get(
            guild,
            _ => _.defaultRole,
            _ => discord.fetchRole(guild, _)
          )
      }

      function set<A>(guild: Guild, lens: Lens<GuildState, A>, a: A): Future<boolean> {
        const guildId = GuildId.wrap(guild.id)
        return pipe(
          guildStatePersistence.find(guildId),
          Future.map(Maybe.getOrElse(() => GuildState.empty(guildId))),
          Future.map(lens.set(a)),
          Future.chain(_ => guildStatePersistence.upsert(guildId, _))
        )
      }

      function get<A, B>(
        guild: Guild,
        getter: (state: GuildState) => Maybe<A>,
        fetch: (a: A) => Future<Maybe<B>>
      ): Future<Maybe<B>> {
        return pipe(
          guildStatePersistence.find(GuildId.wrap(guild.id)),
          Future.chain(
            flow(
              Maybe.chain(getter),
              Maybe.fold(() => Future.right(Maybe.none), fetch)
            )
          )
        )
      }
    })
  )
