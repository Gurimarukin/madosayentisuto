import { pipe } from 'fp-ts/function'

import type { Log } from '../../shared/models/log/Log'
import type { LogsWithTotalCount } from '../../shared/models/log/LogsWithTotalCount'
import { Sink } from '../../shared/models/rx/Sink'
import { IO, List } from '../../shared/utils/fp'
import { Future, toUnit } from '../../shared/utils/fp'

import { constants } from '../constants'
import { Store } from '../models/Store'
import type { LogPersistence } from '../persistence/LogPersistence'

export type LogService = ReturnType<typeof LogService>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const LogService = (logPersistence: LogPersistence) => {
  const buffer = Store<List<Log>>([])

  const list: Future<LogsWithTotalCount> = pipe(
    logPersistence.count,
    Future.chain(totalCount =>
      pipe(
        logPersistence.list({
          skip: Math.max(0, totalCount - constants.logsLimit),
          limit: constants.logsLimit,
        }),
        Sink.readonlyArray,
        Future.map((logs): LogsWithTotalCount => ({ logs, totalCount })),
      ),
    ),
    Future.chain(({ logs, totalCount }) =>
      pipe(
        Future.fromIOEither(buffer.get),
        Future.map(
          (bufferLogs): LogsWithTotalCount => ({
            logs: pipe(logs, List.concat(bufferLogs)),
            totalCount: totalCount + bufferLogs.length,
          }),
        ),
      ),
    ),
  )

  const addLog = (log: Log): IO<void> => pipe(buffer.modify(List.append(log)), IO.map(toUnit))

  const saveLogs: Future<void> = pipe(
    buffer.get,
    IO.chainFirst(() => buffer.set([])),
    Future.fromIOEither,
    Future.chain(logs =>
      pipe(
        logPersistence.insertMany(logs),
        Future.map(toUnit),
        Future.orElse(() =>
          pipe(
            buffer.modify(newLogs => pipe(logs, List.concat(newLogs))),
            Future.fromIOEither,
            Future.map(toUnit),
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
