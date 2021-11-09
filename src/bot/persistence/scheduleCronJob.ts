import { globalConfig } from 'bot/constants'
import type { LoggerGetter } from 'bot/models/logger/LoggerType'
import type { CronJob } from 'bot/models/MadEvent'
import { MadEvent } from 'bot/models/MadEvent'
import type { TSubject } from 'bot/models/rx/TSubject'
import { DateUtils } from 'bot/utils/DateUtils'
import { StringUtils } from 'bot/utils/StringUtils'
import { pipe } from 'fp-ts/function'
import { MsDuration } from 'shared/models/MsDuration'
import { IO } from 'shared/utils/fp'

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
          () => pipe(subject.next(MadEvent.CronJob), IO.runUnsafe),
          MsDuration.unwrap(globalConfig.cronJobInterval),
        ),
      ),
    ),
    IO.map(() => {}),
  )
}
