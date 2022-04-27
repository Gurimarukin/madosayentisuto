/* eslint-disable functional/no-expression-statement, functional/no-return-void */
import { apply, json } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
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
import { logger } from '../utils/logger'
import { useHttp } from './HttpContext'

type LogContext = {
  readonly logs: List<Log>
  readonly tryRefetchInitialLogs: () => void
}

const LogContext = createContext<LogContext | undefined>(undefined)

export const LogContextProvider: React.FC = ({ children }) => {
  const { http } = useHttp()

  const initialLogsFetched = useRef(false)
  const fetchInitialLogs = useCallback(
    (): Future<void> =>
      initialLogsFetched.current
        ? Future.unit
        : pipe(
            Future.tryCatch(() =>
              http(apiRoutes.logs.get, {}, [List.decoder(Log.apiCodec), 'Log[]']),
            ),
            Future.map(initialLogs => {
              setLogs(prev => pipe(initialLogs, List.concat(prev)))
              // eslint-disable-next-line functional/immutable-data
              initialLogsFetched.current = true
            }),
          ),
    [http],
  )

  const [logs, setLogs] = useState<List<Log>>([])

  useEffect(() => {
    const { closeWebSocket } = pipe(
      initWs,
      IO.chainFirst(({ wsClientEventObservable }) =>
        pipe(wsClientEventObservable, TObservable.subscribe({ next: onWSClientEvent })),
      ),
      IO.chainFirst(() => IO.runFutureUnsafe(fetchInitialLogs())),
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
          // return Future.fromIOEither(logger.info(e)) // TODO: do something?
          return Future.unit
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
  }, [fetchInitialLogs])

  const tryRefetchInitialLogs = useCallback(
    (): Promise<void> => Future.runUnsafe(fetchInitialLogs()),
    [fetchInitialLogs],
  )

  const value: LogContext = {
    logs,
    tryRefetchInitialLogs,
  }

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
  const url = new URL(apiRoutes.logs.ws, config.apiHost)
  // eslint-disable-next-line functional/immutable-data
  url.protocol = window.location.protocol.startsWith('https') ? 'wss' : 'ws'
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
