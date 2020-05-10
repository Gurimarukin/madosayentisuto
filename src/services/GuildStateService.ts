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

        setDefaultRole: (guild: Guild, role: Role): Future<boolean> =>
          set(guild, GuildState.Lens.defaultRole, Maybe.some(TSnowflake.wrap(role.id))),

        getDefaultRole: (guild: Guild): Future<Maybe<Role>> =>
          pipe(
            guildStatePersistence.find(GuildId.wrap(guild.id)),
            Future.chain(
              flow(
                Maybe.chain(_ => _.defaultRole),
                Maybe.fold(
                  () => Future.right(Maybe.none),
                  _ => discord.fetchRole(guild, _)
                )
              )
            )
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
    })
  )
