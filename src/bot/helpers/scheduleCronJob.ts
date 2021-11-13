import { date } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { MsDuration } from '../../shared/models/MsDuration'
import { Future, IO } from '../../shared/utils/fp'

import type { MadEventCronJob } from '../models/events/MadEvent'
import { MadEvent } from '../models/events/MadEvent'
import type { LoggerGetter } from '../models/logger/LoggerType'
import type { TSubject } from '../models/rx/TSubject'
import { DateUtils } from '../utils/DateUtils'
import { StringUtils } from '../utils/StringUtils'

const { pad10, pad100 } = StringUtils

const cronJobInterval = MsDuration.days(1)

export const scheduleCronJob = (
  Logger: LoggerGetter,
  subject: TSubject<MadEventCronJob>,
): IO<void> => {
  const logger = Logger('scheduleCronJob')

  return pipe(
    date.create,
    IO.fromIO,
    IO.map(now => {
      const tomorrow8am = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 8)
      return pipe(
        tomorrow8am,
        DateUtils.minusDuration(MsDuration.fromDate(now)),
        MsDuration.fromDate,
      )
    }),
    IO.chainFirst(untilTomorrow8am =>
      logger.info(
        `Scheduling activity refresh - 8am is in ${pretty(untilTomorrow8am)} (interval: ${pretty(
          cronJobInterval,
        )})`,
      ),
    ),
    IO.chain(untilTomorrow8am =>
      pipe(setCronJobInterval(), Future.fromIOEither, Future.delay(untilTomorrow8am), IO.runFuture),
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
    return subject.next(MadEvent.CronJob())
  }
}

const pretty = (ms: MsDuration): string => {
  const d = new Date(Date.UTC(0, 0, 0, 0, 0, 0, MsDuration.unwrap(ms)))
  const h = Math.floor(MsDuration.unwrap(ms) / (1000 * 60 * 60))
  const m = d.getUTCMinutes()
  const s = d.getUTCSeconds()
  const ms_ = d.getUTCMilliseconds()
  return `${pad10(h)}:${pad10(m)}:${pad10(s)}.${pad100(ms_)}`
}
