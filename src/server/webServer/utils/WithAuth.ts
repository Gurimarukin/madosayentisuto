import { pipe } from 'fp-ts/function'
import { Status } from 'hyper-ts'

import { Future, Maybe } from '../../../shared/utils/fp'

import type { EndedMiddleware } from '../models/MyMiddleware'
import { MyMiddleware as M } from '../models/MyMiddleware'

export type WithAuth = (f: (u: unknown /* user: User */) => EndedMiddleware) => EndedMiddleware

type Args = {
  readonly isDisabled: boolean
}

export const WithAuth =
  (/* userService: UserService */ { isDisabled }: Args): WithAuth =>
  f =>
    pipe(
      // H.decodeHeader('Authorization', Token.codec.decode),
      // H.ichain((/* token */) =>
      // pipe(
      /* userService.findByToken(token) */
      Future.right<Maybe<unknown>>(isDisabled ? Maybe.some(undefined) : Maybe.none),
      M.fromTaskEither,
      M.ichain(Maybe.fold(() => M.text(Status.Unauthorized)(), f)),
      // )),
    )
