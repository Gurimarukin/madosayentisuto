import { apply, json } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'
import React, { useEffect, useState } from 'react'
import ReconnectingWebSocket from 'reconnecting-websocket'
import type {
  CloseEvent as ReconnectingCloseEvent,
  ErrorEvent as ReconnectingErrorEvent,
  Event as ReconnectingEvent,
} from 'reconnecting-websocket'
import { interval } from 'rxjs'

import { DayJs } from '../../shared/models/DayJs'
import { LogLevel } from '../../shared/models/LogLevel'
import type { LoggerType } from '../../shared/models/LoggerType'
import { MsDuration } from '../../shared/models/MsDuration'
import { ClientToServerEvent } from '../../shared/models/event/ClientToServerEvent'
import type { ServerToClientEvent } from '../../shared/models/event/ServerToClientEvent'
import { ObserverWithRefinement } from '../../shared/models/rx/ObserverWithRefinement'
import { PubSub } from '../../shared/models/rx/PubSub'
import { TObservable } from '../../shared/models/rx/TObservable'
import type { TSubject } from '../../shared/models/rx/TSubject'
import type { Color } from '../../shared/utils/Color'
import { PubSubUtils } from '../../shared/utils/PubSubUtils'
import { Either, Future, IO, List, toUnit } from '../../shared/utils/fp'

import { Header } from '../components/Header'
import { config } from '../config/unsafe'
import { WSClientEvent } from '../model/event/WSClientEvent'

type Log = {
  readonly date: DayJs
  readonly name: string
  readonly level: LogLevel
  readonly message: string
}

export const ConsoleLog = (): JSX.Element => {
  const [logs, setLogs] = useState<List<Log>>([])

  useEffect(() => {
    const { clientToServerEventSubject, closeWebSocket } = pipe(
      initWs,
      IO.chainFirst(({ wsClientEventObservable }) =>
        pipe(wsClientEventObservable, TObservable.subscribe({ next: onWSClientEvent })),
      ),
      IO.runUnsafe,
    )
    /* eslint-disable */
    interval(1000).subscribe(a =>
      IO.runUnsafe(clientToServerEventSubject.next(ClientToServerEvent.Dummy({ a }))),
    )
    /* eslint-enable */
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

  return (
    <div className="h-full flex flex-col">
      <Header>ConsoleLog</Header>
      <div className="flex-grow px-3 py-2 bg-black overflow-x-hidden overflow-y-auto">
        <pre className="w-full grid grid-cols-[min-content_min-content_1fr] gap-x-3 text-sm">
          {logs.map(({ date, name, level, message }) => (
            <div key={pipe(date, DayJs.unixMs, MsDuration.unwrap)} className="contents">
              {color(level.toUpperCase(), LogLevel.hexColor[level])}
              {color(pipe(date, DayJs.format('YYYY/MM/DD HH:mm:ss')), LogLevel.hexColor.debug)}
              <span className="whitespace-pre-wrap">
                {name} - {message}
              </span>
            </div>
          ))}
        </pre>
      </div>
    </div>
  )
}

const color = (str: string, col: Color): JSX.Element => <span style={{ color: col }}>{str}</span>

const reconnectingWebSocket: IO<ReconnectingWebSocket> = IO.tryCatch(() => {
  const url = new URL('/', config.apiHost)
  // eslint-disable-next-line functional/no-expression-statement, functional/immutable-data
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

        PubSubUtils.subscribeWithRefinement(
          logger,
          wsClientEventPubSub.observable,
        )(
          ObserverWithRefinement.fromNext(
            WSClientEvent,
            'Close',
          )(() =>
            pipe(
              apply.sequenceT(IO.ApplyPar)(
                // TODO: don't complete, makes both pubSubs singletons (moar global)
                wsClientEventPubSub.subject.complete,
                clientToServerEventPubSub.subject.complete,
              ),
              Future.fromIOEither,
              Future.map(toUnit),
            ),
          ),
        ),

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

const logger: LoggerType = {
  debug: (...params) => IO.fromIO(() => console.debug(...params)),
  info: (...params) => IO.fromIO(() => console.info(...params)),
  warn: (...params) => IO.fromIO(() => console.warn(...params)),
  error: (...params) => IO.fromIO(() => console.error(...params)),
}
