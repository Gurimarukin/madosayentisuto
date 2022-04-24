import * as C from 'io-ts/Codec'

import { GuildId } from '../../../shared/models/guild/GuildId'

import { ChannelId } from '../ChannelId'
import { RoleId } from '../RoleId'

const codec = C.struct({
  guild: GuildId.codec,
  role: RoleId.codec,
  channel: ChannelId.codec,
})

export type ReminderWho = C.TypeOf<typeof codec>
export const ReminderWho = { codec }
