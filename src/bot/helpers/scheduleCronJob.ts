import { pipe } from 'fp-ts/function'

import { MsDuration } from '../../shared/models/MsDuration'
import { IO } from '../../shared/utils/fp'

import { globalConfig } from '../constants'
import type { CronJob } from '../models/events/MadEvent'
import { MadEvent } from '../models/events/MadEvent'
import type { LoggerGetter } from '../models/logger/LoggerType'
import type { TSubject } from '../models/rx/TSubject'
import { DateUtils } from '../utils/DateUtils'
import { StringUtils } from '../utils/StringUtils'

const { pad10, pad100 } = StringUtils

export const scheduleCronJob = (Logger: LoggerGetter, subject: TSubject<CronJob>): IO<void> => {
  const logger = Logger('scheduleCronJob')

  const { hours, minutes, seconds, milliseconds } = DateUtils.msFormat(globalConfig.cronJobInterval)

  return pipe(
    logger.info(
      `Scheduling cron job - interval: ${pad10(hours)}:${pad10(minutes)}:${pad10(seconds)}.${pad100(
        milliseconds,
      )}`,
    ),
    IO.chain(() =>
      IO.tryCatch(() =>
        setInterval(
          () => pipe(subject.next(MadEvent.CronJob()), IO.runUnsafe),
          MsDuration.unwrap(globalConfig.cronJobInterval),
        ),
      ),
    ),
    IO.map(() => {}),
  )
}
