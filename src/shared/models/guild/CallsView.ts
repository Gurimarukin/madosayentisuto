import * as C from 'io-ts/Codec'

import { ChannelView } from '../ChannelView'
import { MessageView } from '../MessageView'
import { RoleView } from './RoleView'

const codec = C.struct({
  message: MessageView.codec,
  channel: ChannelView.codec,
  role: RoleView.codec,
})

export type CallsView = C.TypeOf<typeof codec>

export const CallsView = { codec }
