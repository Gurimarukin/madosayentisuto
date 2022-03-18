import { pipe } from 'fp-ts/function'
import { Status } from 'hyper-ts'

import type { GuildId } from '../../../shared/models/guild/GuildId'
import { GuildView } from '../../../shared/models/guild/GuildView'
import { GuildViewShort } from '../../../shared/models/guild/GuildViewShort'
import { futureMaybe } from '../../../shared/utils/FutureMaybe'
import { Future, IO, List, Maybe } from '../../../shared/utils/fp'

import { DiscordConnector } from '../../helpers/DiscordConnector'
import { EndedMiddleware } from '../models/EndedMiddleware'

export type DiscordClientController = ReturnType<typeof DiscordClientController>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const DiscordClientController = (discord: DiscordConnector) => ({
  guilds: (/* user: User */): EndedMiddleware =>
    pipe(
      discord.getGuilds,
      IO.map(List.map(GuildViewShort.fromGuild)),
      EndedMiddleware.fromIOEither,
      EndedMiddleware.ichain(
        EndedMiddleware.json(Status.OK, List.encoder(GuildViewShort.codec).encode),
      ),
    ),

  guild: (guildId: GuildId) => (/* user: User */): EndedMiddleware =>
    pipe(
      futureMaybe.Do,
      futureMaybe.apS('guild', Future.fromIOEither(discord.getGuild(guildId))),
      futureMaybe.bind('members', ({ guild }) =>
        futureMaybe.fromFuture(DiscordConnector.fetchMembers(guild)),
      ),
      futureMaybe.map(({ guild, members }) => GuildView.fromGuild(guild, members.toJSON())),
      EndedMiddleware.fromTaskEither,
      EndedMiddleware.ichain(
        Maybe.fold(
          () => EndedMiddleware.text(Status.NotFound)(),
          EndedMiddleware.json(Status.OK, GuildView.codec.encode),
        ),
      ),
    ),
})
