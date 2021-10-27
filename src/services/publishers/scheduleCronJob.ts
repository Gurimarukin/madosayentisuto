import { pipe } from 'fp-ts/function'

import { globalConfig } from '../../globalConfig'
import { MadEvent } from '../../models/MadEvent'
import { MsDuration } from '../../models/MsDuration'
import { DateUtils } from '../../utils/DateUtils'
import { IO } from '../../utils/fp'
import { StringUtils } from '../../utils/StringUtils'
import { PartialLogger } from '../Logger'
import { PubSub } from '../PubSub'

export const scheduleCronJob = (Logger: PartialLogger, pubSub: PubSub<MadEvent>): IO<void> => {
  const logger = Logger('scheduleCronJob')

  const { hours, minutes, seconds } = DateUtils.msFormat(globalConfig.cronJobInterval)

  return pipe(
    logger.info(
      `Scheduling cron job - interval: ${StringUtils.pad10(hours)}:${StringUtils.pad10(
        minutes,
      )}'${StringUtils.pad10(seconds)}"`,
    ),
    IO.chain(() =>
      IO.tryCatch(() =>
        setInterval(
          () => pipe(publishEvent(), IO.runUnsafe),
          MsDuration.unwrap(globalConfig.cronJobInterval),
        ),
      ),
    ),
    IO.map(() => {}),
  )

  function publishEvent(): IO<void> {
    return pubSub.publish(MadEvent.CronJob)
  }
}
