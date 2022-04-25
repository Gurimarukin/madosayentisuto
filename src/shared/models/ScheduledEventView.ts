import { pipe } from 'fp-ts/function'
import * as C from 'io-ts/Codec'

import { Maybe } from '../utils/fp'
import { DayJsFromISOString } from '../utils/ioTsUtils'
import { ChannelId } from './ChannelId'
import { GuildId } from './guild/GuildId'

const commonCodec = C.struct({
  scheduledAt: DayJsFromISOString.codec,
})

const reminderCodec = C.struct({
  type: C.literal('Reminder'),
  createdBy: C.struct({
    tag: C.string,
    avatar: Maybe.codec(C.string),
  }),
  who: Maybe.codec(
    C.struct({
      guild: C.struct({
        id: GuildId.codec,
        name: C.string,
        icon: Maybe.codec(C.string),
      }),
      channel: C.struct({
        id: ChannelId.codec,
        name: C.string,
      }),
      role: C.struct({
        name: C.string,
        color: C.string,
      }),
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

type Reminder = Common & C.TypeOf<typeof reminderCodec>
type ItsFriday = Common & C.TypeOf<typeof itsFridayCodec>

type ReminderArgs = Omit<Reminder, 'type'>
type ItsFridayArgs = Omit<ItsFriday, 'type'>

export const ScheduledEventView = {
  Reminder: (args: ReminderArgs): Reminder => ({ type: 'Reminder', ...args }),
  ItsFriday: (args: ItsFridayArgs): ItsFriday => ({ type: 'ItsFriday', ...args }),
  codec,
}
