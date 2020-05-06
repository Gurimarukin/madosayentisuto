import { Guild, Role } from 'discord.js'

import { DiscordConnector } from './DiscordConnector'
import { PartialLogger } from './Logger'
import { GuildId } from '../models/GuildId'
import { GuildState } from '../models/GuildState'
import { TSnowflake } from '../models/TSnowflake'
import { GuildStatePersistence } from '../persistence/GuildStatePersistence'
import { pipe, Maybe, Future } from '../utils/fp'

export interface GuildStateService {
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
        setDefaultRole: (guild: Guild, role: Role): Future<boolean> => {
          const guildId = GuildId.wrap(guild.id)
          return pipe(
            guildStatePersistence.find(guildId),
            Future.map(Maybe.getOrElse(() => GuildState.empty(guildId))),
            Future.map(GuildState.Lens.defaultRole.set(Maybe.some(TSnowflake.wrap(role.id)))),
            Future.chain(_ => guildStatePersistence.upsert(guildId, _))
          )
        },

        getDefaultRole: (guild: Guild): Future<Maybe<Role>> =>
          pipe(
            guildStatePersistence.find(GuildId.wrap(guild.id)),
            Future.chain(_ =>
              pipe(
                _,
                Maybe.chain(_ => _.defaultRole),
                Maybe.fold(
                  () => Future.right(Maybe.none),
                  _ => discord.fetchRole(guild, _)
                )
              )
            )
          )
      }
    })
  )
