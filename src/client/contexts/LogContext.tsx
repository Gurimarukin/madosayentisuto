/* eslint-disable functional/no-expression-statement */
import { apply, json } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'
import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import ReconnectingWebSocket from 'reconnecting-websocket'
import type {
  CloseEvent as ReconnectingCloseEvent,
  ErrorEvent as ReconnectingErrorEvent,
  Event as ReconnectingEvent,
} from 'reconnecting-websocket'

import { apiRoutes } from '../../shared/ApiRouter'
import { DayJs } from '../../shared/models/DayJs'
import { Log } from '../../shared/models/Log'
import { ClientToServerEvent } from '../../shared/models/event/ClientToServerEvent'
import type { ServerToClientEvent } from '../../shared/models/event/ServerToClientEvent'
import { ObserverWithRefinement } from '../../shared/models/rx/ObserverWithRefinement'
import { PubSub } from '../../shared/models/rx/PubSub'
import { TObservable } from '../../shared/models/rx/TObservable'
import type { TSubject } from '../../shared/models/rx/TSubject'
import { PubSubUtils } from '../../shared/utils/PubSubUtils'
import { Either, Future, IO, List } from '../../shared/utils/fp'

import { config } from '../config/unsafe'
import { WSClientEvent } from '../model/event/WSClientEvent'
import { http } from '../utils/http'
import { logger } from '../utils/logger'

type LogContext = {
  readonly logs: List<Log>
}

const LogContext = createContext<LogContext | undefined>(undefined)

export const LogContextProvider: React.FC = ({ children }) => {
  const [logs, setLogs] = useState<List<Log>>([])

  const initialLogsFetched = useRef(false)
  useEffect(() => {
    const { closeWebSocket } = pipe(
      initWs,
      IO.chainFirst(({ wsClientEventObservable }) =>
        pipe(wsClientEventObservable, TObservable.subscribe({ next: onWSClientEvent })),
      ),
      IO.chainFirst(() =>
        initialLogsFetched.current
          ? IO.unit
          : pipe(
              fetchInitialLogs,
              Future.map(initialLogs => {
                setLogs(prev => pipe(initialLogs, List.concat(prev)))
                // eslint-disable-next-line functional/immutable-data
                initialLogsFetched.current = true
              }),
              IO.runFutureUnsafe,
            ),
      ),
      IO.runUnsafe,
    )
    return () => pipe(closeWebSocket, IO.runUnsafe)

    function onWSClientEvent(e: WSClientEvent): Future<void> {
      switch (e.type) {
        case 'Message':
          return onServerToClientEvent(e.event)
        case 'Open':
        case 'Close':
        case 'WSError':
        case 'InvalidMessageError':
          return Future.fromIOEither(logger.info(e))
      }
    }

    function onServerToClientEvent(e: ServerToClientEvent): Future<void> {
      switch (e.type) {
        case 'Log':
          const { name, level, message } = e
          return pipe(
            DayJs.now,
            Future.fromIO,
            Future.map(date => setLogs(List.append({ date, name, level, message }))),
          )
      }
    }
  }, [])

  const value: LogContext = { logs }

  return <LogContext.Provider value={value}>{children}</LogContext.Provider>
}

export const useLog = (): LogContext => {
  const context = useContext(LogContext)
  if (context === undefined) {
    // eslint-disable-next-line functional/no-throw-statement
    throw Error('useLog must be used within a LogContextProvider')
  }
  return context
}

const reconnectingWebSocket: IO<ReconnectingWebSocket> = IO.tryCatch(() => {
  const url = new URL(apiRoutes.index, config.apiHost)
  // eslint-disable-next-line functional/immutable-data
  url.protocol = window.location.protocol.startsWith('https') ? 'ws' : 'ws'
  return new ReconnectingWebSocket(url.toString())
})

type InitWSResult = {
  readonly clientToServerEventSubject: TSubject<ClientToServerEvent>
  readonly wsClientEventObservable: TObservable<WSClientEvent>
  readonly closeWebSocket: IO<void>
}

const initWs: IO<InitWSResult> = pipe(
  reconnectingWebSocket,
  IO.chain(ws => {
    const wsClientEventPubSub = PubSub<WSClientEvent>()
    const pub = PubSubUtils.publish(wsClientEventPubSub.subject.next)('addEventListener')<{
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
          logger,
          clientToServerEventPubSub.observable,
        )(
          ObserverWithRefinement.of({
            next: flow(
              ClientToServerEvent.codec.encode,
              json.stringify,
              Either.mapLeft(Either.toError),
              Future.fromEither,
              Future.chainIOEitherK(encodedJson => IO.tryCatch(() => ws.send(encodedJson))),
            ),
          }),
        ),
      ),
      IO.map(
        (): InitWSResult => ({
          clientToServerEventSubject: clientToServerEventPubSub.subject,
          wsClientEventObservable: wsClientEventPubSub.observable,
          closeWebSocket: IO.tryCatch(() => ws.close()),
        }),
      ),
    )
  }),
)

const fetchInitialLogs: Future<List<Log>> = Future.tryCatch(() =>
  http(apiRoutes.logs.get, {}, [List.decoder(Log.apiCodec), 'Log[]']),
)
