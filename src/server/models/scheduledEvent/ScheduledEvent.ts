import { pipe } from 'fp-ts/function'
import * as C from 'io-ts/Codec'

import { DayJsFromDate } from '../../utils/ioTsUtils'
import { Reminder as ReminderType } from './Reminder'

const reminderCodec = C.struct({
  type: C.literal('Reminder'),
  reminder: ReminderType.codec,
})

const itsFridayCodec = C.struct({
  type: C.literal('ItsFriday'),
})

const commonCodec = C.struct({
  createdAt: DayJsFromDate.codec,
  scheduledAt: DayJsFromDate.codec,
})

const codec = pipe(
  commonCodec,
  C.intersect(
    C.sum('type')({
      Reminder: reminderCodec,
      ItsFriday: itsFridayCodec,
    }),
  ),
)

export type ScheduledEvent = C.TypeOf<typeof codec>
export type ScheduledEventOutput = C.OutputOf<typeof codec>

type ScheduledEventCommon = C.TypeOf<typeof commonCodec>

export type ScheduledEventReminder = ScheduledEventCommon & C.TypeOf<typeof reminderCodec>
export type ScheduledEventItsFriday = ScheduledEventCommon & C.TypeOf<typeof itsFridayCodec>

type ReminderArgs = Omit<ScheduledEventReminder, 'type'>

export const ScheduledEvent = {
  Reminder: (args: ReminderArgs): ScheduledEventReminder => ({ type: 'Reminder', ...args }),
  ItsFriday: (args: ScheduledEventCommon): ScheduledEventItsFriday => ({
    type: 'ItsFriday',
    ...args,
  }),
  codec,
}