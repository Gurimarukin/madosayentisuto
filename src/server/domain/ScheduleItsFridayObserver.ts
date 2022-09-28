import { random } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { DayJs } from '../../shared/models/DayJs'
import { MsDuration } from '../../shared/models/MsDuration'
import { ObserverWithRefinement } from '../../shared/models/rx/ObserverWithRefinement'
import { StringUtils } from '../../shared/utils/StringUtils'
import { Future, IO } from '../../shared/utils/fp'

import { constants } from '../config/constants'
import { MadEvent } from '../models/event/MadEvent'
import type { LoggerGetter } from '../models/logger/LoggerObservable'
import { ScheduledEvent } from '../models/scheduledEvent/ScheduledEvent'
import type { ScheduledEventService } from '../services/ScheduledEventService'

const rangeStart = constants.itsFriday.hourRange.start
const rangeEnd = constants.itsFriday.hourRange.end

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const ScheduleItsFridayObserver = (
  Logger: LoggerGetter,
  scheduledEventService: ScheduledEventService,
) => {
  const logger = Logger('ScheduleItsFridayObserver')

  return ObserverWithRefinement.fromNext(
    MadEvent,
    'CronJob',
  )(({ date }) => {
    const isFriday = DayJs.day.get(date) === constants.itsFriday.day
    return isFriday && pipe(date, DayJs.isHourSharp(8)) ? scheduleItsFriday(date) : Future.unit
  })

  function scheduleItsFriday(now: DayJs): Future<void> {
    return pipe(
      randomTime(now),
      IO.chainFirst(scheduledAt =>
        logger.info(
          `Scheduling "It's friday" at ${pipe(scheduledAt, DayJs.format('HH:mm:ss'))} (in ${pipe(
            scheduledAt,
            DayJs.diff(now),
            StringUtils.prettyMs,
          )})`,
        ),
      ),
      Future.fromIOEither,
      Future.chain(scheduledAt =>
        scheduledEventService.create(ScheduledEvent.ItsFriday({ createdAt: now, scheduledAt })),
      ),
      Future.chainIOEitherK(success =>
        success ? IO.unit : logger.warn(`Failed to schedule "It's friday"`),
      ),
    )
  }
}

function randomTime(now: DayJs): IO<DayJs> {
  const todayRangeStart = pipe(now, DayJs.startOf('hour'), DayJs.hour.set(rangeStart))
  return pipe(
    random.randomRange(0, MsDuration.unwrap(MsDuration.hours(rangeEnd - rangeStart))),
    IO.fromIO,
    IO.map(n => pipe(todayRangeStart, DayJs.add(MsDuration.wrap(n)))),
  )
}
