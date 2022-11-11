import type { Message } from 'discord.js'
import * as C from 'io-ts/Codec'

import { MessageId } from './MessageId'

const codec = C.struct({
  id: MessageId.codec,
  url: C.string,
  content: C.string,
})

export type MessageView = C.TypeOf<typeof codec>

const fromMessage = (m: Message): MessageView => ({
  id: MessageId.fromMessage(m),
  url: m.url,
  content: m.cleanContent,
})

export const MessageView = { fromMessage, codec }
