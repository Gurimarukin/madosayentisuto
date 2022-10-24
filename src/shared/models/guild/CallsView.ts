import * as C from 'io-ts/Codec'

import { ChannelView } from '../ChannelView'
import { RoleView } from './RoleView'

const codec = C.struct({
  channel: ChannelView.codec,
  role: RoleView.codec,
})

export type CallsView = C.TypeOf<typeof codec>

export const CallsView = { codec }
