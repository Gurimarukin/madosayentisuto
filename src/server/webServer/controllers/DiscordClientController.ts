import { pipe } from 'fp-ts/function'
import { Status } from 'hyper-ts'

import { GuildDetailDAO } from '../../../shared/models/guild/GuildDetailDAO'
import type { GuildId } from '../../../shared/models/guild/GuildId'
import { GuildShortDAO } from '../../../shared/models/guild/GuildShortDAO'
import { IO, List, Maybe } from '../../../shared/utils/fp'

import type { DiscordConnector } from '../../helpers/DiscordConnector'
import { EndedMiddleware } from '../models/EndedMiddleware'

export type DiscordClientController = ReturnType<typeof DiscordClientController>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const DiscordClientController = (discord: DiscordConnector) => {
  const guilds = (/* user: User */): EndedMiddleware =>
    pipe(
      discord.getGuilds,
      IO.map(List.map(GuildShortDAO.fromGuild)),
      EndedMiddleware.fromIOEither,
      EndedMiddleware.ichain(
        EndedMiddleware.json(Status.OK, List.encoder(GuildShortDAO.codec).encode),
      ),
    )

  const guild = (guildId: GuildId) => (/* user: User */): EndedMiddleware =>
    pipe(
      discord.getGuild(guildId),
      IO.map(Maybe.map(GuildDetailDAO.fromGuild)),
      EndedMiddleware.fromIOEither,
      EndedMiddleware.ichain(
        Maybe.fold(
          () => EndedMiddleware.text(Status.NotFound)(),
          EndedMiddleware.json(Status.OK, GuildDetailDAO.codec.encode),
        ),
      ),
    )

  return { guilds, guild }
}
