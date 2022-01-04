import { pipe } from 'fp-ts/function'
import { Status } from 'hyper-ts'

import { GuildDAO } from '../../../shared/models/guild/GuildDAO'
import { List } from '../../../shared/utils/fp'

import type { DiscordConnector } from '../../helpers/DiscordConnector'
import type { EndedMiddleware } from '../models/EndedMiddleware'
import { EndendMiddleware } from '../models/EndedMiddleware'

export type DiscordClientController = ReturnType<typeof DiscordClientController>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const DiscordClientController = (discord: DiscordConnector) => {
  const guilds: EndedMiddleware = pipe(
    discord.client.guilds.cache.toJSON(),
    List.map(GuildDAO.fromGuild),
    EndendMiddleware.json(Status.OK, List.encoder(GuildDAO.codec).encode),
  )

  return { guilds }
}
