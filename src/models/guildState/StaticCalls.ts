import * as C from 'io-ts/Codec'

import { TSnowflake } from '../TSnowflake'
import { Calls } from './Calls'

const codec = C.struct({
  message: TSnowflake.codec, // listen reactions to this message
  channel: TSnowflake.codec, // notify in this channel
  role: TSnowflake.codec, // mention this role
})

const fromCalls = ({ message, channel, role }: Calls): StaticCalls => ({
  message: TSnowflake.wrap(message.id),
  channel: TSnowflake.wrap(channel.id),
  role: TSnowflake.wrap(role.id),
})

export type StaticCalls = C.TypeOf<typeof codec>
export const StaticCalls = { codec, fromCalls }
