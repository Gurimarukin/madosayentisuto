import { parse as parseCookie } from 'cookie'
import { flow, pipe } from 'fp-ts/function'
import { Status } from 'hyper-ts'

import { Dict, Either, Future, Maybe, Try } from '../../../shared/utils/fp'
import { futureMaybe } from '../../../shared/utils/futureMaybe'

import { constants } from '../../config/constants'
import type { TokenContent } from '../../models/webUser/TokenContent'
import type { UserService } from '../../services/UserService'
import type { EndedMiddleware } from '../models/MyMiddleware'
import { MyMiddleware as M } from '../models/MyMiddleware'
import { SimpleHttpResponse } from '../models/SimpleHttpResponse'
import type { UpgradeHandler } from '../models/UpgradeHandler'

export type WithAuth = {
  middleware: (f: (user: TokenContent) => EndedMiddleware) => EndedMiddleware
  upgrade: (f: (user: TokenContent) => UpgradeHandler) => UpgradeHandler
}

export const WithAuth = (userService: UserService): WithAuth => ({
  middleware: f =>
    pipe(
      M.getCookies(),
      M.map(Dict.lookup(constants.account.cookie.name)),
      M.ichain(
        Maybe.fold(
          () => M.sendWithStatus(Status.Unauthorized)(''),
          flow(
            userService.verifyToken,
            M.fromTaskEither,
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
    ),

  upgrade: f => (request, socket, head) =>
    pipe(
      futureMaybe.fromNullable(request.headers.cookie),
      futureMaybe.chainEitherK(cookie => Try.tryCatch(() => parseCookie(cookie))),
      futureMaybe.chainOptionK(Dict.lookup(constants.account.cookie.name)),
      Future.chain(
        Maybe.fold(
          () => Future.successful(Either.left(SimpleHttpResponse.of(Status.Unauthorized, ''))),
          flow(
            userService.verifyToken,
            Future.map(Either.right),
            Future.orElse(() =>
              Future.successful(
                Either.left(
                  SimpleHttpResponse.of(Status.Unauthorized, 'Invalid token', {
                    'Set-Cookie': [
                      `${constants.account.cookie.name}=`,
                      'Path=/',
                      'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
                    ],
                  }),
                ),
              ),
            ),
          ),
        ),
      ),
      Future.chain(
        Either.fold(flow(Either.left, Future.successful), user => f(user)(request, socket, head)),
      ),
    ),
})
