import { pipe } from 'fp-ts/function'

import { MsDuration } from '../../shared/models/MsDuration'
import { StringUtils } from '../../shared/utils/StringUtils'
import { Future, IO } from '../../shared/utils/fp'

import type { MadEventCronJob } from '../models/events/MadEvent'
import { MadEvent } from '../models/events/MadEvent'
import type { LoggerGetter } from '../models/logger/LoggerType'
import type { TSubject } from '../models/rx/TSubject'
import { DateUtils } from '../utils/DateUtils'

const cronJobInterval = MsDuration.minutes(1)

export const scheduleCronJob = (
  Logger: LoggerGetter,
  subject: TSubject<MadEventCronJob>,
): IO<void> => {
  const logger = Logger('scheduleCronJob')

  return pipe(
    DateUtils.now,
    IO.fromIO,
    IO.map(now => {
      const nextMinute = now.startOf('minute').add(1, 'minute')
      return pipe(nextMinute, DateUtils.diff(now))
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
      IO.map(() => {}),
    )
  }

  function publishEvent(): IO<void> {
    return pipe(
      DateUtils.now,
      IO.fromIO,
      IO.chain(now => subject.next(MadEvent.CronJob(now.second(0).millisecond(0)))), // assuming interval is 1 minute
    )
  }
}
