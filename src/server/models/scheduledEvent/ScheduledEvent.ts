import type { Guild, Role, User } from 'discord.js'
import { pipe } from 'fp-ts/function'
import * as C from 'io-ts/Codec'

import type { DayJs } from '../../../shared/models/DayJs'
import type { ScheduledEventViewReminder } from '../../../shared/models/ScheduledEventView'
import { UserView } from '../../../shared/models/UserView'
import { GuildViewShort } from '../../../shared/models/guild/GuildViewShort'
import { RoleView } from '../../../shared/models/guild/RoleView'
import { Maybe } from '../../../shared/utils/fp'

import type { NamedChannel } from '../../utils/ChannelUtils'
import { ChannelUtils } from '../../utils/ChannelUtils'
import { DayJsFromDate } from '../../utils/ioTsUtils'
import { Reminder as ReminderType } from './Reminder'

const commonCodec = C.struct({
  createdAt: DayJsFromDate.codec,
  scheduledAt: DayJsFromDate.codec,
})

const reminderCodec = C.struct({
  type: C.literal('Reminder'),
  reminder: ReminderType.codec,
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

export type ScheduledEvent = C.TypeOf<typeof codec>

type Common = C.TypeOf<typeof commonCodec>

export type ScheduledEventReminder = Common & C.TypeOf<typeof reminderCodec>
export type ScheduledEventItsFriday = Common & C.TypeOf<typeof itsFridayCodec>

type ReminderArgs = Omit<ScheduledEventReminder, 'type'>
type ItsFridayArgs = Omit<ScheduledEventItsFriday, 'type'>

type ToViewArgs = {
  scheduledAt: DayJs
  createdBy: User
  who: Maybe<{
    guild: Guild
    role: Role
    channel: NamedChannel
  }>
  what: string
}

export const ScheduledEvent = {
  Reminder: (args: ReminderArgs): ScheduledEventReminder => ({ type: 'Reminder', ...args }),
  ItsFriday: (args: ItsFridayArgs): ScheduledEventItsFriday => ({ type: 'ItsFriday', ...args }),
  codec,

  reminderToView: ({
    scheduledAt,
    createdBy,
    who,
    what,
  }: ToViewArgs): ScheduledEventViewReminder => ({
    type: 'Reminder',
    scheduledAt,
    createdBy: UserView.fromUser(createdBy),
    who: pipe(
      who,
      Maybe.map(({ guild, channel, role }) => ({
        guild: GuildViewShort.fromGuild(guild),
        channel: ChannelUtils.toView(channel),
        role: RoleView.fromRole(role),
      })),
    ),
    what,
  }),
}
