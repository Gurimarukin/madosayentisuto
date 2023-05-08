import * as C from 'io-ts/Codec'

import { ChannelView } from './ChannelView'
import { MessageId } from './MessageId'

type MessageView = C.TypeOf<typeof codec>

const codec = C.struct({
  id: MessageId.codec,
  url: C.string,
  channel: ChannelView.codec,
  content: C.string,
})

const MessageView = { codec }

export { MessageView }
