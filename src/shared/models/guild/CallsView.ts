import * as C from 'io-ts/Codec'

import { List, Maybe } from '../../utils/fp'
import { ChannelView } from '../ChannelView'
import { RoleView } from './RoleView'

const codec = C.struct({
  channel: ChannelView.codec,
  role: RoleView.codec,
  whitelistedChannels: Maybe.codec(List.codec(ChannelView.codec)),
})

export type CallsView = C.TypeOf<typeof codec>

export const CallsView = { codec }
