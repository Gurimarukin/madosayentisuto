import * as C from 'io-ts/Codec'

import { TSnowflake } from '../TSnowflake'
import { Calls } from './Calls'

export type StaticCalls = C.TypeOf<typeof StaticCalls.codec>

export function StaticCalls(
  message: TSnowflake,
  channel: TSnowflake,
  role: TSnowflake,
): StaticCalls {
  return { message, channel, role }
}

export namespace StaticCalls {
  export const codec = C.type({
    message: TSnowflake.codec, // listen reactions to this message
    channel: TSnowflake.codec, // notify in this channel
    role: TSnowflake.codec, // mention this role
  })

  export const fromCalls = ({ message, channel, role }: Calls): StaticCalls => ({
    message: TSnowflake.wrap(message.id),
    channel: TSnowflake.wrap(channel.id),
    role: TSnowflake.wrap(role.id),
  })
}
