import { pipe } from 'fp-ts/function'
import { Status } from 'hyper-ts'

import { LoginPayload } from '../../../shared/models/webUser/LoginPayload'
import { Token } from '../../../shared/models/webUser/Token'
import { Maybe } from '../../../shared/utils/fp'

import { constants } from '../../constants'
import type { UserService } from '../../services/UserService'
import type { EndedMiddleware } from '../models/MyMiddleware'
import { MyMiddleware as M } from '../models/MyMiddleware'

export type UserController = ReturnType<typeof UserController>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function UserController(userService: UserService) {
  const login: EndedMiddleware = pipe(
    M.decodeBody([LoginPayload.codec, 'LoginPayload']),
    M.matchE(
      () => M.of(Maybe.none),
      ({ userName, password }) => M.fromTaskEither(userService.login(userName, password)),
    ),
    M.ichain(
      Maybe.fold(
        () => M.sendWithStatus(Status.BadRequest)(''),
        token =>
          pipe(
            M.status(Status.NoContent),
            M.ichain(() =>
              M.cookie(constants.account.cookie.name, Token.codec.encode(token), {
                maxAge: constants.account.cookie.ttl,
                httpOnly: true,
                sameSite: 'strict',
              }),
            ),
            M.ichain(() => M.closeHeaders()),
            M.ichain(() => M.send('')),
          ),
      ),
    ),
  )

  return { login }
}
