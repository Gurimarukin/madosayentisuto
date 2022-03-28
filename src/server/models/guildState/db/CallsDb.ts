import * as C from 'io-ts/Codec'

import { ChannelId } from '../../ChannelId'
import { MessageId } from '../../MessageId'
import { TSnowflake } from '../../TSnowflake'
import type { Calls } from '../Calls'

const codec = C.struct({
  message: MessageId.codec, // listen reactions to this message
  channel: ChannelId.codec, // notify in this channel
  role: TSnowflake.codec, // mention this role
})

const fromCalls = ({ message, channel, role }: Calls): CallsDb => ({
  message: MessageId.fromMessage(message),
  channel: ChannelId.fromChannel(channel),
  role: TSnowflake.wrap(role.id),
})

export type CallsDb = C.TypeOf<typeof codec>
export const CallsDb = { codec, fromCalls }
