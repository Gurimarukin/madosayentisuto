import { pipe } from 'fp-ts/function'
import * as C from 'io-ts/Codec'

import { Maybe } from '../utils/fp'
import { DayJsFromISOString } from '../utils/ioTsUtils'
import { ChannelView } from './ChannelView'
import { UserView } from './UserView'
import { GuildViewShort } from './guild/GuildViewShort'
import { RoleView } from './guild/RoleView'

const commonCodec = C.struct({
  scheduledAt: DayJsFromISOString.codec,
})

const reminderCodec = C.struct({
  type: C.literal('Reminder'),
  createdBy: UserView.codec,
  who: Maybe.codec(
    C.struct({
      guild: GuildViewShort.codec,
      channel: ChannelView.codec,
      role: RoleView.codec,
    }),
  ),
  what: C.string,
})

const itsFridayCodec = C.struct({
  type: C.literal('ItsFriday'),
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

export type ScheduledEventView = C.TypeOf<typeof codec>

type Common = C.TypeOf<typeof commonCodec>

export type ScheduledEventViewReminder = Common & C.TypeOf<typeof reminderCodec>
type ScheduledEventViewItsFriday = Common & C.TypeOf<typeof itsFridayCodec>

type ReminderArgs = Omit<ScheduledEventViewReminder, 'type'>
type ItsFridayArgs = Omit<ScheduledEventViewItsFriday, 'type'>

export const ScheduledEventView = {
  Reminder: (args: ReminderArgs): ScheduledEventViewReminder => ({ type: 'Reminder', ...args }),
  ItsFriday: (args: ItsFridayArgs): ScheduledEventViewItsFriday => ({ type: 'ItsFriday', ...args }),
  codec,
}
