import * as C from 'io-ts/Codec'

import { TSnowflake } from 'bot/models/TSnowflake'
import type { Calls } from 'bot/models/guildState/Calls'

const codec = C.struct({
  message: TSnowflake.codec, // listen reactions to this message
  channel: TSnowflake.codec, // notify in this channel
  role: TSnowflake.codec, // mention this role
})

const fromCalls = ({ message, channel, role }: Calls): CallsDb => ({
  message: TSnowflake.wrap(message.id),
  channel: TSnowflake.wrap(channel.id),
  role: TSnowflake.wrap(role.id),
})

export type CallsDb = C.TypeOf<typeof codec>
export const CallsDb = { codec, fromCalls }
