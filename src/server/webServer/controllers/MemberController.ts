import { pipe } from 'fp-ts/function'
import { Status } from 'hyper-ts'

import type { DiscordUserId } from '../../../shared/models/DiscordUserId'
import { DayJsFromISOString } from '../../../shared/utils/ioTsUtils'

import type { MemberBirthdateService } from '../../services/MemberBirthdateService'
import type { EndedMiddleware } from '../models/MyMiddleware'
import { MyMiddleware as M } from '../models/MyMiddleware'

export type MemberController = ReturnType<typeof MemberController>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const MemberController = (memberBirthdateService: MemberBirthdateService) => ({
  updateMemberBirthdate: (userId: DiscordUserId) => (/* user: User */): EndedMiddleware =>
    /* User.canUpdateMember(user) */
    pipe(
      M.decodeBody([DayJsFromISOString.decoder, 'DayJsFromISOString']),
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
