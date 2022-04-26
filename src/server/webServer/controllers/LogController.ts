import { pipe } from 'fp-ts/function'
import { Status } from 'hyper-ts'

import { Log } from '../../../shared/models/Log'
import { Sink } from '../../../shared/models/rx/Sink'
import { List } from '../../../shared/utils/fp'

import type { LogService } from '../../services/LogService'
import type { EndedMiddleware } from '../models/MyMiddleware'
import { MyMiddleware as M } from '../models/MyMiddleware'

export type LogController = ReturnType<typeof LogController>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const LogController = (logService: LogService) => ({
  listLogs: (/* user: User */): EndedMiddleware =>
    pipe(
      logService.list,
      Sink.readonlyArray,
      M.fromTaskEither,
      M.ichain(M.jsonWithStatus(Status.OK, List.encoder(Log.apiCodec))),
    ),
})
