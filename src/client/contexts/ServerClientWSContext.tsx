/* eslint-disable functional/no-expression-statement */
import { apply, io, json } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'
import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import type {
  CloseEvent as ReconnectingCloseEvent,
  ErrorEvent as ReconnectingErrorEvent,
  Event as ReconnectingEvent,
} from 'reconnecting-websocket'
import ReconnectingWebSocket from 'reconnecting-websocket'

import { apiRoutes } from '../../shared/ApiRouter'
import { ClientToServerEvent } from '../../shared/models/event/ClientToServerEvent'
import type { ServerToClientEvent } from '../../shared/models/event/ServerToClientEvent'
import { ObserverWithRefinement } from '../../shared/models/rx/ObserverWithRefinement'
import { PubSub } from '../../shared/models/rx/PubSub'
import { TObservable } from '../../shared/models/rx/TObservable'
import type { TSubject } from '../../shared/models/rx/TSubject'
import { PubSubUtils } from '../../shared/utils/PubSubUtils'
import { Either, Future, IO, Maybe, NotUsed, toNotUsed } from '../../shared/utils/fp'

import { config } from '../config/unsafe'
import { WSClientEvent } from '../model/event/WSClientEvent'
import { basicAsyncRenderer } from '../utils/basicAsyncRenderer'
import { getOnError } from '../utils/getOnError'
import { logger } from '../utils/logger'

type ServerClientWSContext = {
  readonly clientToServerEventSubject: TSubject<ClientToServerEvent>
  readonly serverToClientEventObservable: TObservable<ServerToClientEvent>
}

const ServerClientWSContext = createContext<ServerClientWSContext | undefined>(undefined)

export const ServerClientWSContextProvider: React.FC = ({ children }) => {
  const [data, setData] = useState<ServerClientWSContext | undefined>(undefined)
  const [error, setError] = useState<Error | undefined>(undefined)

  const closeWebSocket = useRef<IO<void> | null>(null)

  useEffect(() => {
    pipe(
      initWs,
      IO.map(d => {
        setData(d.value)
        // eslint-disable-next-line functional/immutable-data
        closeWebSocket.current = d.closeWebSocket
        return NotUsed
      }),
      IO.run(e =>
        pipe(
          logger.error(e),
          io.chain(Either.fold(() => pipe(() => console.error(e), io.map(toNotUsed)), io.of)),
          io.map(() => {
            setError(e)
            return NotUsed
          }),
        ),
      ),
    )
    return () => {
      if (closeWebSocket.current === null) return

      pipe(closeWebSocket.current, IO.map(toNotUsed), IO.run(getOnError))
    }
  }, [])

  return basicAsyncRenderer({ data, error })(value => (
    <ServerClientWSContext.Provider value={value}>{children}</ServerClientWSContext.Provider>
  ))
}

// export const ServerClientWSContext  ={}

export const useServerClientWS = (): ServerClientWSContext => {
  const context = useContext(ServerClientWSContext)
  if (context === undefined) {
    // eslint-disable-next-line functional/no-throw-statement
    throw Error('useServerClientWS must be used within a ServerClientWSContextProvider')
  }
  return context
}

const reconnectingWebSocket: IO<ReconnectingWebSocket> = IO.tryCatch(() => {
  const url = new URL(apiRoutes.ws, config.apiHost)
  // eslint-disable-next-line functional/immutable-data
  url.protocol = window.location.protocol.startsWith('https') ? 'wss' : 'ws'
  return new ReconnectingWebSocket(url.toString())
})

type InitWSResult = {
  readonly value: ServerClientWSContext
  readonly closeWebSocket: IO<void>
}

const initWs: IO<InitWSResult> = pipe(
  reconnectingWebSocket,
  IO.chain(ws => {
    const wsClientEventPubSub = PubSub<WSClientEvent>()
    const pub = PubSubUtils.publish(getOnError)(wsClientEventPubSub.subject.next)(
      'addEventListener',
    )<{
      /* eslint-disable functional/no-return-void */
      readonly open: (event: ReconnectingEvent) => void
      readonly close: (event: ReconnectingCloseEvent) => void
      readonly error: (event: ReconnectingErrorEvent) => void
      readonly message: (event: MessageEvent<unknown>) => void
      /* eslint-enable functional/no-return-void */
    }>(ws)

    const clientToServerEventPubSub = PubSub<ClientToServerEvent>()

    return pipe(
      apply.sequenceT(IO.ApplyPar)(
        // wsClientEventPubSub
        pub('open', WSClientEvent.Open),
        pub('close', WSClientEvent.Close),
        pub('error', WSClientEvent.WSError),
        pub('message', WSClientEvent.messageFromRawEvent),

        // clientToServerEventPubSub
        PubSubUtils.subscribeWithRefinement(
          getOnError,
          clientToServerEventPubSub.observable,
        )(
          ObserverWithRefinement.of({
            next: flow(
              ClientToServerEvent.codec.encode,
              json.stringify,
              Either.mapLeft(Either.toError),
              Future.fromEither,
              Future.chainIOEitherK(encodedJson => IO.tryCatch(() => ws.send(encodedJson))),
              Future.map(toNotUsed),
            ),
          }),
        ),
      ),
      // TODO: chainFirst subscribe wsClientEventObservable and do something on Open, Close, WSError or InvalidMessageError?
      IO.map(
        (): InitWSResult => ({
          value: {
            clientToServerEventSubject: clientToServerEventPubSub.subject,
            serverToClientEventObservable: pipe(
              wsClientEventPubSub.observable,
              TObservable.filterMap(e => (e.type === 'Message' ? Maybe.some(e.event) : Maybe.none)),
            ),
          },
          // TODO: close pubsubs as well?
          closeWebSocket: IO.tryCatch(() => ws.close()),
        }),
      ),
    )
  }),
)
