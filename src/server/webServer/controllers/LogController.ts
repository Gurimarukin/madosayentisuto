import { json } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'
import { Status } from 'hyper-ts'
import { WebSocketServer } from 'ws'

import { Log } from '../../../shared/models/Log'
import { ServerToClientEvent } from '../../../shared/models/event/ServerToClientEvent'
import { ObserverWithRefinement } from '../../../shared/models/rx/ObserverWithRefinement'
import { Sink } from '../../../shared/models/rx/Sink'
import type { TObservable } from '../../../shared/models/rx/TObservable'
import type { TSubject } from '../../../shared/models/rx/TSubject'
import { PubSubUtils } from '../../../shared/utils/PubSubUtils'
import { Either, Future, IO, List } from '../../../shared/utils/fp'

import { logger } from '../../../client/utils/logger'

import { WSServerEvent } from '../../models/event/WSServerEvent'
import type { LogService } from '../../services/LogService'
import { unknownToError } from '../../utils/unknownToError'
import type { EndedMiddleware } from '../models/MyMiddleware'
import { MyMiddleware as M } from '../models/MyMiddleware'
import type { UpgradeHandler } from '../models/UpgradeHandler'

export type LogController = ReturnType<typeof LogController>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const LogController = (
  logService: LogService,
  serverToClientEventObservable: TObservable<ServerToClientEvent>,
  wsServerEventSubject: TSubject<WSServerEvent>,
) => {
  // TODO: move to WebSocketUtils
  const wss = new WebSocketServer({ noServer: true })
    .on('connection', ws =>
      pipe(
        IO.tryCatch(() =>
          ws.on(
            'message',
            flow(WSServerEvent.messageFromRawData, wsServerEventSubject.next, IO.runUnsafe),
          ),
        ),
        IO.chain(() =>
          PubSubUtils.subscribeWithRefinement(
            logger,
            serverToClientEventObservable,
          )(
            ObserverWithRefinement.of({
              next: flow(
                ServerToClientEvent.codec.encode,
                json.stringify,
                Either.mapLeft(unknownToError),
                Future.fromEither,
                Future.chainIOEitherK(encodedJson => IO.tryCatch(() => ws.send(encodedJson))),
              ),
            }),
          ),
        ),
        IO.runUnsafe,
      ),
    )
    .on('close', () => IO.runUnsafe(wsServerEventSubject.next(WSServerEvent.Closed())))

  return {
    listLogs: (/* user: User */): EndedMiddleware =>
      pipe(
        logService.list,
        Sink.readonlyArray,
        M.fromTaskEither,
        M.ichain(M.jsonWithStatus(Status.OK, List.encoder(Log.apiCodec))),
      ),

    webSocket: (/* user: User */): UpgradeHandler => (request, socket, head) => pipe(
        IO.tryCatch(() =>
          wss.handleUpgrade(request, socket, head, ws => wss.emit('connection', ws, request)),
        ),
        Future.fromIOEither,
        Future.map(Either.right),
      ),
  }
}
