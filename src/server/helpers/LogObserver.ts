import { pipe } from 'fp-ts/function'
import { lens } from 'monocle-ts'

import { DayJs } from '../../shared/models/DayJs'
import type { LogEvent } from '../../shared/models/event/LogEvent'
import { ServerToClientEvent } from '../../shared/models/event/ServerToClientEvent'
import { ObserverWithRefinement } from '../../shared/models/rx/ObserverWithRefinement'
import type { TObserver } from '../../shared/models/rx/TObserver'
import type { TSubject } from '../../shared/models/rx/TSubject'
import { toUnit } from '../../shared/utils/fp'
import { IO } from '../../shared/utils/fp'
import { Future } from '../../shared/utils/fp'

import type { MadEventCronJob } from '../models/event/MadEvent'
import { MadEvent } from '../models/event/MadEvent'
import type { LogService } from '../services/LogService'

export type LogObserver = {
  readonly logEventObserver: TObserver<LogEvent>
  readonly madEventObserver: ObserverWithRefinement<MadEvent, MadEventCronJob>
}

export const LogObserver = (
  logService: LogService,
  serverToClientEventSubject: TSubject<ServerToClientEvent>,
): LogObserver => {
  return {
    logEventObserver: {
      next: ({ name, level, message }) =>
        level !== 'debug'
          ? Future.unit
          : pipe(
              serverToClientEventSubject.next(ServerToClientEvent.Log({ name, level, message })),
              IO.chain(() => IO.fromIO(DayJs.now)),
              IO.chain(date => logService.addLog({ date, name, level, message })),
              Future.fromIOEither,
            ),
    },

    madEventObserver: ObserverWithRefinement.fromNext(
      MadEvent,
      'CronJob',
    )(({ date }) =>
      pipe(
        pipe(date, DayJs.isHourSharp(0)) ? cleanOldLogs(date) : Future.unit,
        Future.chain(() => logService.saveLogs),
      ),
    ),
  }

  function cleanOldLogs(date: DayJs): Future<void> {
    return pipe(
      date,
      pipe(
        DayJs.day,
        lens.modify(d => d - 1),
      ),
      logService.deleteBeforeDate,
      Future.map(toUnit),
    )
  }
}
