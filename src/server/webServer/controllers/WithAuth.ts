import { pipe } from 'fp-ts/function'
import { Status } from 'hyper-ts'

import { Future, Maybe } from '../../../shared/utils/fp'

import { EndedMiddleware } from '../models/EndedMiddleware'

export type WithAuth = (f: (u: unknown /* user: User */) => EndedMiddleware) => EndedMiddleware

type Args = {
  readonly isDisabled: boolean
}

export const WithAuth =
  (/* userService: UserService */ { isDisabled }: Args): WithAuth =>
  f =>
    pipe(
      // EndedMiddleware.decodeHeader('Authorization', Token.codec.decode),
      // EndedMiddleware.ichain((/* token */) =>
      // pipe(
      EndedMiddleware.fromTaskEither(
        /* userService.findByToken(token) */
        Future.right<Maybe<unknown>>(isDisabled ? Maybe.some(undefined) : Maybe.none),
      ),
      EndedMiddleware.ichain(Maybe.fold(() => EndedMiddleware.text(Status.Unauthorized)(), f)),
      // )),
      EndedMiddleware.orElse(() => EndedMiddleware.text(Status.Forbidden)()),
    )
