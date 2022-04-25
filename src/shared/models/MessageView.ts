import type { Message } from 'discord.js'
import * as C from 'io-ts/Codec'

const codec = C.struct({
  url: C.string,
  content: C.string,
})

export type MessageView = C.TypeOf<typeof codec>

const fromMessage = (m: Message): MessageView => ({
  url: m.url,
  content: m.cleanContent,
})

export const MessageView = { fromMessage, codec }
