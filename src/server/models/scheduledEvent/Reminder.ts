import * as C from 'io-ts/Codec'

import { DiscordUserId } from '../../../shared/models/DiscordUserId'
import { Maybe } from '../../../shared/utils/fp'
import { DayJsFromDate } from '../../../shared/utils/ioTsUtils'

import { RoleId } from '../RoleId'

const codec = C.struct({
  createdBy: DiscordUserId.codec,
  who: Maybe.codec(RoleId.codec),
  when: DayJsFromDate.codec,
  what: C.string,
})

export type Reminder = C.TypeOf<typeof codec>
export const Reminder = { codec }
