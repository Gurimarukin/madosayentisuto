import { json } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'
import { Status } from 'hyper-ts'
import type { Subscription } from 'rxjs'
import wsLib from 'ws'

import { ServerToClientEvent } from '../../shared/models/event/ServerToClientEvent'
import { LogsWithCount } from '../../shared/models/log/LogsWithCount'
import { ObserverWithRefinement } from '../../shared/models/rx/ObserverWithRefinement'
import type { TObservable } from '../../shared/models/rx/TObservable'
import type { TSubject } from '../../shared/models/rx/TSubject'
import { PubSubUtils } from '../../shared/utils/PubSubUtils'
import type { NotUsed } from '../../shared/utils/fp'
import { Either, Future, IO, toNotUsed } from '../../shared/utils/fp'

import { WSServerEvent } from '../models/event/WSServerEvent'
import type { LoggerGetter } from '../models/logger/LoggerObservable'
import type { LogService } from '../services/LogService'
import { getOnError } from '../utils/getOnError'
import { unknownToError } from '../utils/unknownToError'
import type { EndedMiddleware } from '../webServer/models/MyMiddleware'
import { MyMiddleware as M } from '../webServer/models/MyMiddleware'
import type { UpgradeHandler } from '../webServer/models/UpgradeHandler'

const { WebSocketServer } = wsLib

export type LogController = ReturnType<typeof LogController>

export const LogController = (
  Logger: LoggerGetter,
  logService: LogService,
  serverToClientEventObservable: TObservable<ServerToClientEvent>,
  wsServerEventSubject: TSubject<WSServerEvent>,
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
) => {
  const logger = Logger('LogController')

  // TODO: move to WebSocketUtils
  const wss = new WebSocketServer({ noServer: true })
    .on('connection', ws =>
      pipe(
        IO.tryCatch(() =>
          ws.on(
            'message',
            flow(
              WSServerEvent.messageFromRawData,
              wsServerEventSubject.next,
              IO.run(getOnError(logger)),
            ),
          ),
        ),
        IO.chain(() =>
          PubSubUtils.subscribeWithRefinement(
            getOnError(logger),
            serverToClientEventObservable,
          )(
            ObserverWithRefinement.of({
              next: flow(
                ServerToClientEvent.codec.encode,
                json.stringify,
                Either.mapLeft(unknownToError),
                Future.fromEither,
                Future.chainIOEitherK(encodedJson => IO.tryCatch(() => ws.send(encodedJson))),
                Future.map(toNotUsed),
              ),
            }),
          ),
        ),
        IO.map<Subscription, NotUsed>(toNotUsed), // TODO: do something with Subcription?
        IO.run(getOnError(logger)),
      ),
    )
    .on('close', () =>
      pipe(wsServerEventSubject.next(WSServerEvent.Closed()), IO.run(getOnError(logger))),
    )

  return {
    listLogs: (/* user: User */): EndedMiddleware =>
      pipe(
        M.fromTaskEither(logService.list),
        M.ichain(M.jsonWithStatus(Status.OK, LogsWithCount.codec)),
      ),

    webSocket: (/* user: User */): UpgradeHandler => (request, socket, head) =>
      pipe(
        IO.tryCatch(() =>
          wss.handleUpgrade(request, socket, head, ws => wss.emit('connection', ws, request)),
        ),
        Future.fromIOEither,
        Future.map(Either.right),
      ),
  }
}
