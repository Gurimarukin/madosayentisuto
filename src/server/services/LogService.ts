import { apply, io } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { Store } from '../../shared/models/Store'
import type { Log } from '../../shared/models/log/Log'
import type { LogsWithCount } from '../../shared/models/log/LogsWithCount'
import { Sink } from '../../shared/models/rx/Sink'
import type { NotUsed } from '../../shared/utils/fp'
import { Future, List, toNotUsed } from '../../shared/utils/fp'

import { constants } from '../config/constants'
import type { LogPersistence } from '../persistence/LogPersistence'

export type LogService = ReturnType<typeof LogService>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const LogService = (logPersistence: LogPersistence) => {
  const buffer = Store<List<Log>>(List.empty)

  const list: Future<LogsWithCount> = pipe(
    apply.sequenceS(Future.ApplyPar)({
      logs: pipe(
        logPersistence.count,
        Future.chain(nonDebug =>
          pipe(
            logPersistence.list({
              skip: Math.max(0, nonDebug - constants.logsLimit),
              limit: constants.logsLimit,
            }),
            Sink.readonlyArray,
          ),
        ),
      ),
      count: logPersistence.count,
    }),
    Future.chain(({ logs, count }) =>
      pipe(
        buffer.get,
        Future.fromIO,
        Future.map(
          (bufferLogs): LogsWithCount => ({
            logs: pipe(logs, List.concat(bufferLogs)),
            count: count + bufferLogs.length,
          }),
        ),
      ),
    ),
  )

  const addLog = (log: Log): io.IO<NotUsed> =>
    pipe(buffer.modify(List.append(log)), io.map(toNotUsed))

  const saveLogs: Future<NotUsed> = pipe(
    buffer.get,
    io.chainFirst(() => buffer.set([])),
    Future.fromIO,
    Future.chain(logs =>
      pipe(
        logPersistence.insertMany(logs),
        Future.map(toNotUsed),
        Future.orElse(() =>
          pipe(
            buffer.modify(newLogs => pipe(logs, List.concat(newLogs))),
            Future.fromIO,
            Future.map(toNotUsed),
          ),
        ),
      ),
    ),
  )

  return {
    list,
    addLog,
    saveLogs,
    deleteBeforeDate: logPersistence.deleteBeforeDate,
  }
}
