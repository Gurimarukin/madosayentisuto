import { string } from 'fp-ts'
import { pipe } from 'fp-ts/function'
import { Status } from 'hyper-ts'
import type { HeadersOpen, ResponseEnded, StatusOpen } from 'hyper-ts'
import * as M from 'hyper-ts/lib/Middleware'
import type { Middleware } from 'hyper-ts/lib/Middleware'

import { Dict } from '../../../shared/utils/fp'

import { unknownToError } from '../../utils/unknownToError'

export type EndedMiddleware = Middleware<StatusOpen, ResponseEnded, unknown, void>

const text =
  (status: Status, headers: Dict<string, string> = {}) =>
  (message = ''): EndedMiddleware =>
    pipe(
      reduceHeaders(status, headers),
      M.ichain(() => M.closeHeaders()),
      M.ichain(() => M.send(message)),
    )

const json =
  <A, O>(status: Status, encode: (a: A) => O, headers: Dict<string, string> = {}) =>
  (data: A): EndedMiddleware =>
    pipe(
      reduceHeaders(status, headers),
      M.ichain(() => M.json(encode(data), unknownToError)),
      M.orElse(() => text(Status.InternalServerError)()),
    )

const reduceHeaders = (
  status: Status,
  headers: Dict<string, string>,
): Middleware<StatusOpen, HeadersOpen, never, void> =>
  pipe(
    headers,
    Dict.reduceWithIndex(string.Ord)(M.status(status), (key, acc, val) =>
      pipe(
        acc,
        M.ichain(() => M.header(key, val)),
      ),
    ),
  )

export const EndedMiddleware = { ...M, text, json }
