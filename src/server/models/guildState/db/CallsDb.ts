import * as C from 'io-ts/Codec'

import { MessageId } from '../../MessageId'
import { TSnowflake } from '../../TSnowflake'
import type { Calls } from '../Calls'

const codec = C.struct({
  message: MessageId.codec, // listen reactions to this message
  channel: TSnowflake.codec, // notify in this channel
  role: TSnowflake.codec, // mention this role
})

const fromCalls = ({ message, channel, role }: Calls): CallsDb => ({
  message: MessageId.wrap(message.id),
  channel: TSnowflake.wrap(channel.id),
  role: TSnowflake.wrap(role.id),
})

export type CallsDb = C.TypeOf<typeof codec>
export const CallsDb = { codec, fromCalls }
