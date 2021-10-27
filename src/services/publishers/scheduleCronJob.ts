import { task } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { globalConfig } from '../../globalConfig'
import { MadEvent } from '../../models/MadEvent'
import { MsDuration } from '../../models/MsDuration'
import { Future, IO } from '../../utils/fp'
import { StringUtils } from '../../utils/StringUtils'
import { PartialLogger } from '../Logger'
import { PubSub } from '../PubSub'

export const scheduleCronJob = (Logger: PartialLogger, pubSub: PubSub<MadEvent>): IO<void> => {
  const logger = Logger('scheduleCronJob')

  const now = new Date()
  const tomorrow8am = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    globalConfig.cronJob.hour,
  )
  const untilTomorrow8am = new Date(tomorrow8am.getTime() - now.getTime())

  return pipe(
    logger.info(
      `Scheduling activity refresh: ${StringUtils.pad10(
        globalConfig.cronJob.hour,
      )}h00 is in ${StringUtils.pad10(untilTomorrow8am.getHours())}h${StringUtils.pad10(
        untilTomorrow8am.getMinutes(),
      )}`,
    ),
    IO.chain(() =>
      pipe(
        setRefreshActivityInterval(),
        Future.fromIOEither,
        task.delay(untilTomorrow8am.getTime()),
        IO.runFuture,
      ),
    ),
  )

  function setRefreshActivityInterval(): IO<void> {
    return pipe(
      publishEvent(),
      IO.chain(() =>
        IO.tryCatch(() =>
          setInterval(
            () => pipe(publishEvent(), IO.runUnsafe),
            MsDuration.unwrap(globalConfig.cronJob.interval),
          ),
        ),
      ),
      IO.map(() => {}),
    )
  }

  function publishEvent(): IO<void> {
    return pubSub.publish(MadEvent.CronJob)
  }
}
