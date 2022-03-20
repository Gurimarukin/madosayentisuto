import { pipe } from 'fp-ts/function'
import { Status } from 'hyper-ts'

import type { GuildId } from '../../../shared/models/guild/GuildId'
import { GuildView } from '../../../shared/models/guild/GuildView'
import { GuildViewShort } from '../../../shared/models/guild/GuildViewShort'
import type { UserId } from '../../../shared/models/guild/UserId'
import { futureMaybe } from '../../../shared/utils/FutureMaybe'
import { Future, IO, List, Maybe } from '../../../shared/utils/fp'
import { DateFromISOString } from '../../../shared/utils/ioTsUtils'

import { DiscordConnector } from '../../helpers/DiscordConnector'
import type { MemberBirthdateService } from '../../services/MemberBirthdateService'
import type { EndedMiddleware } from '../models/MyMiddleware'
import { MyMiddleware as M } from '../models/MyMiddleware'

export type DiscordClientController = ReturnType<typeof DiscordClientController>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const DiscordClientController = (
  discord: DiscordConnector,
  memberBirthdateService: MemberBirthdateService,
) => ({
  listGuilds: (/* user: User */): EndedMiddleware =>
    pipe(
      discord.getGuilds,
      IO.map(List.map(GuildViewShort.fromGuild)),
      M.fromIOEither,
      M.ichain(M.json(Status.OK, List.encoder(GuildViewShort.codec).encode)),
    ),

  findGuild: (guildId: GuildId) => (/* user: User */): EndedMiddleware =>
    pipe(
      Future.fromIOEither(discord.getGuild(guildId)),
      futureMaybe.chain(guild =>
        pipe(
          DiscordConnector.fetchMembers(guild),
          Future.map(c => GuildView.fromGuild(guild, c.toJSON())),
          futureMaybe.fromFuture,
        ),
      ),
      futureMaybe.chain(guild =>
        pipe(
          guild.members,
          List.map(m => m.id),
          memberBirthdateService.listForMembers,
          Future.map(birthdates => pipe(guild, GuildView.updateBirthdates(birthdates))),
          futureMaybe.fromFuture,
        ),
      ),
      M.fromTaskEither,
      M.ichain(
        Maybe.fold(() => M.text(Status.NotFound)(), M.json(Status.OK, GuildView.codec.encode)),
      ),
    ),

  updateMemberBirthdate: (userId: UserId) => (/* user: User */): EndedMiddleware =>
    /* User.canUpdateMember(user) */
    pipe(
      M.decodeBody([DateFromISOString.decoder, 'DateFromISOString']),
      M.matchE(
        () => M.text(Status.BadRequest)(),
        birthdate =>
          pipe(
            memberBirthdateService.upsert(userId, birthdate),
            M.fromTaskEither,
            M.ichain(success =>
              success ? M.text(Status.NoContent)() : M.text(Status.BadRequest)(),
            ),
          ),
      ),
    ),

  deleteMemberBirthdate: (userId: UserId) => (/* user: User */): EndedMiddleware =>
    pipe(
      memberBirthdateService.remove(userId),
      M.fromTaskEither,
      M.ichain(success => (success ? M.text(Status.NoContent)() : M.text(Status.BadRequest)())),
    ),
})
