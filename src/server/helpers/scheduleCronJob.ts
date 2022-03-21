import { pipe } from 'fp-ts/function'

import { DayJs } from '../../shared/models/DayJs'
import { MsDuration } from '../../shared/models/MsDuration'
import { StringUtils } from '../../shared/utils/StringUtils'
import { Future, IO, toUnit } from '../../shared/utils/fp'

import type { MadEventCronJob } from '../models/event/MadEvent'
import { MadEvent } from '../models/event/MadEvent'
import type { LoggerGetter } from '../models/logger/LoggerType'
import type { TSubject } from '../models/rx/TSubject'

const cronJobInterval = MsDuration.minute(1)

export const scheduleCronJob = (
  Logger: LoggerGetter,
  subject: TSubject<MadEventCronJob>,
): IO<void> => {
  const logger = Logger('scheduleCronJob')

  return pipe(
    DayJs.now,
    IO.fromIO,
    IO.map(now => {
      const nextMinute = pipe(now, DayJs.startOf('minute'), DayJs.add(MsDuration.minute(1)))
      return pipe(nextMinute, DayJs.diff(now))
    }),
    IO.chainFirst(untilNextMinute =>
      logger.info(
        `Scheduling; next minute is in ${StringUtils.prettyMs(
          untilNextMinute,
        )} (interval: ${StringUtils.prettyMs(cronJobInterval)})`,
      ),
    ),
    IO.chain(untilNextMinute =>
      pipe(
        setCronJobInterval(),
        Future.fromIOEither,
        Future.delay(untilNextMinute),
        IO.runFutureUnsafe,
      ),
    ),
  )

  function setCronJobInterval(): IO<void> {
    return pipe(
      publishEvent(),
      IO.chain(() =>
        IO.tryCatch(() =>
          setInterval(() => pipe(publishEvent(), IO.runUnsafe), MsDuration.unwrap(cronJobInterval)),
        ),
      ),
      IO.map(toUnit),
    )
  }

  function publishEvent(): IO<void> {
    return pipe(
      DayJs.now,
      IO.fromIO,
      IO.chain(now =>
        subject.next(MadEvent.CronJob(pipe(now, DayJs.second.set(0), DayJs.millisecond.set(0)))),
      ), // assuming interval is 1 minute
    )
  }
}
