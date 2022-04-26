import { apply } from 'fp-ts'
import { pipe } from 'fp-ts/function'
import { Status } from 'hyper-ts'

import type { GuildId } from '../../../shared/models/guild/GuildId'
import { GuildView } from '../../../shared/models/guild/GuildView'
import { GuildViewShort } from '../../../shared/models/guild/GuildViewShort'
import { Future, IO, List, Maybe } from '../../../shared/utils/fp'
import { futureMaybe } from '../../../shared/utils/futureMaybe'

import { DiscordConnector } from '../../helpers/DiscordConnector'
import { GuildState } from '../../models/guildState/GuildState'
import type { GuildStateService } from '../../services/GuildStateService'
import type { MemberBirthdateService } from '../../services/MemberBirthdateService'
import type { EndedMiddleware } from '../models/MyMiddleware'
import { MyMiddleware as M } from '../models/MyMiddleware'

export type DiscordClientController = ReturnType<typeof DiscordClientController>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const DiscordClientController = (
  discord: DiscordConnector,
  guildStateService: GuildStateService,
  memberBirthdateService: MemberBirthdateService,
) => ({
  listGuilds: (/* user: User */): EndedMiddleware =>
    pipe(
      discord.listGuilds,
      IO.map(List.map(GuildViewShort.fromGuild)),
      M.fromIOEither,
      M.ichain(M.jsonWithStatus(Status.OK, List.encoder(GuildViewShort.codec))),
    ),

  findGuild: (guildId: GuildId) => (/* user: User */): EndedMiddleware =>
    pipe(
      Future.fromIOEither(discord.getGuild(guildId)),
      futureMaybe.chain(guild =>
        pipe(
          apply.sequenceS(Future.ApplyPar)({
            members: DiscordConnector.fetchMembers(guild),
            state: guildStateService.getState(guild),
          }),
          Future.map(({ members, state }) =>
            GuildView.fromGuild(guild, GuildState.toView(state), members.toJSON()),
          ),
          futureMaybe.fromTaskEither,
        ),
      ),
      futureMaybe.chain(guild =>
        pipe(
          guild.members,
          List.map(m => m.id),
          memberBirthdateService.listForMembers,
          Future.map(birthdates => pipe(guild, GuildView.updateBirthdates(birthdates))),
          futureMaybe.fromTaskEither,
        ),
      ),
      M.fromTaskEither,
      M.ichain(
        Maybe.fold(
          () => M.sendWithStatus(Status.NotFound)(''),
          M.jsonWithStatus(Status.OK, GuildView.codec),
        ),
      ),
    ),
})
