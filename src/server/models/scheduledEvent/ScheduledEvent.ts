import * as C from 'io-ts/Codec'

import { Reminder as ReminderType } from './Reminder'

const scheduledReminderCodec = C.struct({
  type: C.literal('Reminder'),
  reminder: ReminderType.codec,
})
type Reminder = C.TypeOf<typeof scheduledReminderCodec>

const codec = C.sum('type')({
  Reminder: scheduledReminderCodec,
})

export type ScheduledEvent = C.TypeOf<typeof codec>
export type ScheduledEventOutput = C.OutputOf<typeof codec>

export const ScheduledEvent = {
  Reminder: (args: Omit<Reminder, 'type'>): Reminder => ({ type: 'Reminder', ...args }),
  codec,
}
