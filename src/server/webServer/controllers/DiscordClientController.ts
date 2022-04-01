import { pipe } from 'fp-ts/function'
import { Status } from 'hyper-ts'

import type { DiscordUserId } from '../../../shared/models/DiscordUserId'
import type { GuildId } from '../../../shared/models/guild/GuildId'
import { GuildView } from '../../../shared/models/guild/GuildView'
import { GuildViewShort } from '../../../shared/models/guild/GuildViewShort'
import { Future, IO, List, Maybe } from '../../../shared/utils/fp'
import { futureMaybe } from '../../../shared/utils/futureMaybe'
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
          DiscordConnector.fetchMembers(guild),
          Future.map(c => GuildView.fromGuild(guild, c.toJSON())),
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

  updateMemberBirthdate: (userId: DiscordUserId) => (/* user: User */): EndedMiddleware =>
    /* User.canUpdateMember(user) */
    pipe(
      M.decodeBody([DateFromISOString.decoder, 'DateFromISOString']),
      M.matchE(
        () => M.of(false),
        birthdate => M.fromTaskEither(memberBirthdateService.upsert(userId, birthdate)),
      ),
      M.ichain(success =>
        success ? M.sendWithStatus(Status.NoContent)('') : M.sendWithStatus(Status.BadRequest)(''),
      ),
    ),

  deleteMemberBirthdate: (userId: DiscordUserId) => (/* user: User */): EndedMiddleware =>
    pipe(
      memberBirthdateService.remove(userId),
      M.fromTaskEither,
      M.ichain(success =>
        success ? M.sendWithStatus(Status.NoContent)('') : M.sendWithStatus(Status.BadRequest)(''),
      ),
    ),
})
