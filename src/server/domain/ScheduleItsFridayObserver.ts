import { io, random } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { DayJs } from '../../shared/models/DayJs'
import { MsDuration } from '../../shared/models/MsDuration'
import { ObserverWithRefinement } from '../../shared/models/rx/ObserverWithRefinement'
import { StringUtils } from '../../shared/utils/StringUtils'
import type { NotUsed } from '../../shared/utils/fp'
import { Future, IO } from '../../shared/utils/fp'

import { MadEvent } from '../models/event/MadEvent'
import type { LoggerGetter } from '../models/logger/LoggerObservable'
import { ScheduledEvent } from '../models/scheduledEvent/ScheduledEvent'
import type { ScheduledEventService } from '../services/ScheduledEventService'

const friday = 5
const rangeStart = 14
const rangeEnd = 17

export const ScheduleItsFridayObserver = (
  Logger: LoggerGetter,
  scheduledEventService: ScheduledEventService,
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
) => {
  const logger = Logger('ScheduleItsFridayObserver')

  return ObserverWithRefinement.fromNext(
    MadEvent,
    'CronJob',
  )(({ date }) => {
    const isFriday = DayJs.day.get(date) === friday
    return isFriday && pipe(date, DayJs.isHourSharp(8)) ? scheduleItsFriday(date) : Future.notUsed
  })

  function scheduleItsFriday(now: DayJs): Future<NotUsed> {
    return pipe(
      randomTime(now),
      Future.fromIO,
      Future.chainFirstIOEitherK(scheduledAt =>
        logger.info(
          `Scheduling "It's friday" at ${pipe(scheduledAt, DayJs.format('HH:mm:ss'))} (in ${pipe(
            scheduledAt,
            DayJs.diff(now),
            StringUtils.prettyMs,
          )})`,
        ),
      ),
      Future.chain(scheduledAt =>
        scheduledEventService.create(ScheduledEvent.ItsFriday({ createdAt: now, scheduledAt })),
      ),
      Future.chainIOEitherK(success =>
        success ? IO.notUsed : logger.warn(`Failed to schedule "It's friday"`),
      ),
    )
  }
}

function randomTime(now: DayJs): io.IO<DayJs> {
  const todayRangeStart = pipe(now, DayJs.startOf('hour'), DayJs.hour.set(rangeStart))
  return pipe(
    random.randomRange(0, MsDuration.unwrap(MsDuration.hours(rangeEnd - rangeStart))),
    io.map(n => pipe(todayRangeStart, DayJs.add(MsDuration.ms(n)), DayJs.startOf('minute'))),
  )
}
