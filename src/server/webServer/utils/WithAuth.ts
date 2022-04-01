import { pipe } from 'fp-ts/function'
import { Status } from 'hyper-ts'

import { Dict, Maybe } from '../../../shared/utils/fp'

import { constants } from '../../constants'
import type { TokenContent } from '../../models/webUser/TokenContent'
import type { UserService } from '../../services/UserService'
import type { EndedMiddleware } from '../models/MyMiddleware'
import { MyMiddleware as M } from '../models/MyMiddleware'

export type WithAuth = (f: (user: TokenContent) => EndedMiddleware) => EndedMiddleware

export const WithAuth =
  (userService: UserService): WithAuth =>
  f =>
    pipe(
      M.getCookies(),
      M.map(Dict.lookup(constants.account.cookie.name)),
      M.ichain(
        Maybe.fold(
          () => M.sendWithStatus(Status.Unauthorized)(''),
          cookie =>
            pipe(
              M.fromTaskEither(userService.verifyToken(cookie)),
              M.matchE(
                () =>
                  pipe(
                    M.status(Status.Unauthorized),
                    M.ichain(() => M.clearCookie(constants.account.cookie.name, {})),
                    M.ichain(() => M.closeHeaders()),
                    M.ichain(() => M.send('Invalid token')),
                  ),
                f,
              ),
            ),
        ),
      ),
    )
