import * as C from 'io-ts/Codec'

import { DiscordUserId } from '../../../shared/models/DiscordUserId'
import { Maybe } from '../../../shared/utils/fp'

import { ReminderWho } from './ReminderWho'

const codec = C.struct({
  createdBy: DiscordUserId.codec,
  who: Maybe.codec(ReminderWho.codec),
  what: C.string,
})

export type Reminder = C.TypeOf<typeof codec>
export const Reminder = { codec }
