import type { Message } from 'discord.js'
import { eq } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { MessageId } from '../../shared/models/MessageId'
import type { MessageView } from '../../shared/models/MessageView'

import { ChannelUtils } from './ChannelUtils'

const toView = (m: Message): MessageView => ({
  id: MessageId.fromMessage(m),
  url: m.url,
  channel: ChannelUtils.toView(m.channel),
  content: m.cleanContent,
})

const byId: eq.Eq<Message> = pipe(MessageId.Eq, eq.contramap(MessageId.fromMessage))

export const MessageUtils = { toView, Eq: { byId } }
