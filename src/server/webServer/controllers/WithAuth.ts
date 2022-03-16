import { pipe } from 'fp-ts/function'
import { Status } from 'hyper-ts'
import * as D from 'io-ts/Decoder'

import { Future, Maybe } from '../../../shared/utils/fp'

import { EndedMiddleware } from '../models/EndedMiddleware'

export type WithAuth = (f: (u: unknown /* user: User */) => EndedMiddleware) => EndedMiddleware

export const WithAuth = (/* userService: UserService */): WithAuth => f =>
  pipe(
    EndedMiddleware.decodeHeader('Authorization', D.string.decode /* Token.codec.decode */),
    EndedMiddleware.ichain((/* token */) =>
      pipe(
        EndedMiddleware.fromTaskEither(
          Future.right<Maybe<unknown>>(Maybe.none) /* userService.findByToken(token) */,
        ),
        EndedMiddleware.ichain(Maybe.fold(() => EndedMiddleware.text(Status.Unauthorized)(), f)),
      )),
    EndedMiddleware.orElse(() => EndedMiddleware.text(Status.Forbidden)()),
  )
