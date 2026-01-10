import { pipe } from 'fp-ts/function'
import * as C from 'io-ts/Codec'

import { ChannelId } from '../../../../shared/models/ChannelId'
import { List, Maybe } from '../../../../shared/utils/fp'

import { RoleId } from '../../RoleId'
import type { Calls } from '../Calls'

const codec = C.struct({
  channel: ChannelId.codec, // notify in this channel
  role: RoleId.codec, // mention this role
  whitelistedChannels: Maybe.codec(List.codec(ChannelId.codec)), // detect calls in these channels; None allows all channels
})

const fromCalls = ({ channel, role, whitelistedChannels }: Calls): CallsDb => ({
  channel: ChannelId.fromChannel(channel),
  role: RoleId.fromRole(role),
  whitelistedChannels: pipe(whitelistedChannels, Maybe.map(List.map(ChannelId.fromChannel))),
})

export type CallsDb = C.TypeOf<typeof codec>
export const CallsDb = { codec, fromCalls }
