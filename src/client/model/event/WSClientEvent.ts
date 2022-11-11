import { json } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'
import * as D from 'io-ts/Decoder'
import type {
  CloseEvent as ReconnectingCloseEvent,
  ErrorEvent as ReconnectingErrorEvent,
  Event as ReconnectingEvent,
} from 'reconnecting-websocket'

import { ServerToClientEvent } from '../../../shared/models/event/ServerToClientEvent'
import { createUnion } from '../../../shared/utils/createUnion'
import { Either } from '../../../shared/utils/fp'
import { decodeError } from '../../../shared/utils/ioTsUtils'

const u = createUnion({
  Open: (event: ReconnectingEvent) => ({ event }),
  Close: (event: ReconnectingCloseEvent) => ({ event }),
  WSError: (event: ReconnectingErrorEvent) => ({ event }),
  InvalidMessageError: (error: Error) => ({ error }),
  Message: (event: ServerToClientEvent) => ({ event }),
})

type InvalidMessageError = typeof u.InvalidMessageError.T
type Message = typeof u.Message.T

export type WSClientEvent = typeof u.T

export const WSClientEvent = {
  is: u.is,
  Open: u.Open,
  Close: u.Close,
  WSError: u.WSError,
  messageFromRawEvent: (event: MessageEvent<unknown>): InvalidMessageError | Message =>
    pipe(
      D.string.decode(event.data),
      Either.mapLeft(decodeError('string')(event.data)),
      Either.chain(flow(json.parse, Either.mapLeft(Either.toError))),
      Either.chain(i =>
        pipe(
          ServerToClientEvent.codec.decode(i),
          Either.mapLeft(decodeError('ServerToClientEvent')(i)),
        ),
      ),
      Either.foldW(u.InvalidMessageError, u.Message),
    ),
}
