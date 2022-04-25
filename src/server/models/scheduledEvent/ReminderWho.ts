import * as C from 'io-ts/Codec'

import { ChannelId } from '../../../shared/models/ChannelId'
import { GuildId } from '../../../shared/models/guild/GuildId'

import { RoleId } from '../RoleId'

const codec = C.struct({
  guild: GuildId.codec,
  role: RoleId.codec,
  channel: ChannelId.codec,
})

export type ReminderWho = C.TypeOf<typeof codec>
export const ReminderWho = { codec }
