import { pipe } from 'fp-ts/function'

import type { Log } from '../../shared/models/Log'
import { TObservable } from '../../shared/models/rx/TObservable'
import { IO, List } from '../../shared/utils/fp'
import { Future, toUnit } from '../../shared/utils/fp'

import { Store } from '../models/Store'
import type { LogPersistence } from '../persistence/LogPersistence'

export type LogService = ReturnType<typeof LogService>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const LogService = (logPersistence: LogPersistence) => {
  const buffer = Store<List<Log>>([])

  const list: TObservable<Log> = pipe(
    logPersistence.list,
    TObservable.concat(
      pipe(
        buffer.get,
        Future.fromIOEither,
        TObservable.fromTaskEither,
        TObservable.chain(TObservable.fromReadonlyArray),
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
