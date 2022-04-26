import { json } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'
import type { RawData } from 'ws'

import { ClientToServerEvent } from '../../../shared/models/event/ClientToServerEvent'
import { createUnion } from '../../../shared/utils/createUnion'
import { Either, Try } from '../../../shared/utils/fp'
import { decodeError } from '../../../shared/utils/ioTsUtils'

import { unknownToError } from '../../utils/unknownToError'

const u = createUnion({
  Closed: () => ({}),
  InvalidMessageError: (error: Error) => ({ error }),
  Message: (event: ClientToServerEvent) => ({ event }),
})

type InvalidMessageError = typeof u.InvalidMessageError.T
type Message = typeof u.Message.T

export type WSServerEvent = typeof u.T

export const WSServerEvent = {
  Closed: u.Closed,
  messageFromRawData: (data: RawData): InvalidMessageError | Message =>
    pipe(
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      Try.tryCatch(() => data.toString('utf-8')),
      Either.chain(flow(json.parse, Either.mapLeft(unknownToError))),
      Either.chain(i =>
        pipe(
          ClientToServerEvent.codec.decode(i),
          Either.mapLeft(decodeError('ClientToServerEvent')(i)),
        ),
      ),
      Either.foldW(u.InvalidMessageError, u.Message),
    ),
}
