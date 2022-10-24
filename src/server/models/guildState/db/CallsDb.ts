import * as C from 'io-ts/Codec'

import { ChannelId } from '../../../../shared/models/ChannelId'

import { RoleId } from '../../RoleId'
import type { Calls } from '../Calls'

const codec = C.struct({
  channel: ChannelId.codec, // notify in this channel
  role: RoleId.codec, // mention this role
})

const fromCalls = ({ channel, role }: Calls): CallsDb => ({
  channel: ChannelId.fromChannel(channel),
  role: RoleId.fromRole(role),
})

export type CallsDb = C.TypeOf<typeof codec>
export const CallsDb = { codec, fromCalls }
