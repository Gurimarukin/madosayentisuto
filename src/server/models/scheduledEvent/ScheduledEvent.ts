import { pipe } from 'fp-ts/function'
import * as C from 'io-ts/Codec'

import type { DayJs } from '../../../shared/models/DayJs'

import { DayJsFromDate } from '../../utils/ioTsUtils'
import { Reminder as ReminderType } from './Reminder'

const scheduledReminderCodec = C.struct({
  type: C.literal('Reminder'),
  reminder: ReminderType.codec,
})

const commonCodec = C.struct({
  createdAt: DayJsFromDate.codec,
  scheduledAt: DayJsFromDate.codec,
})

const codec = pipe(
  commonCodec,
  C.intersect(
    C.sum('type')({
      Reminder: scheduledReminderCodec,
    }),
  ),
)

export type ScheduledEvent = C.TypeOf<typeof codec>
export type ScheduledEventOutput = C.OutputOf<typeof codec>

type ReminderArgs = {
  readonly createdAt: DayJs
  readonly scheduledAt: DayJs
  readonly reminder: ReminderType
}

const Reminder = (args: ReminderArgs): ScheduledEvent => ({ type: 'Reminder', ...args })

export const ScheduledEvent = { Reminder, codec }
