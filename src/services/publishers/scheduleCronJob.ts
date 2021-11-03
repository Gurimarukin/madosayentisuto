import { pipe } from 'fp-ts/function'

import { globalConfig } from '../../globalConfig'
import { MadEvent } from '../../models/MadEvent'
import { MsDuration } from '../../models/MsDuration'
import { TSubject } from '../../models/TSubject'
import { DateUtils } from '../../utils/DateUtils'
import { IO } from '../../utils/fp'
import { StringUtils } from '../../utils/StringUtils'
import { PartialLogger } from '../Logger'

const { pad10, pad100 } = StringUtils

export const scheduleCronJob = (Logger: PartialLogger, subject: TSubject<MadEvent>): IO<void> => {
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
