import { Message } from 'discord.js'

import { PartialLogger } from './Logger'
import { DiscordConnector } from './DiscordConnector'
import { Maybe, pipe, Future } from '../utils/fp'
import { MessageUtils } from '../utils/MessageUtils'

export const Pong = (Logger: PartialLogger, discord: DiscordConnector) => (
  message: Message
): Future<Maybe<Message>> => {
  const logger = Logger('Pong')

  return pipe(
    logger.debug('got message:', message.content),
    Future.fromIOEither,
    // return none to prevent message from being passed to the next message handler
    Future.chain(_ => {
      if (MessageUtils.isDm(message)) {
        if (message.content.trim() === 'ping') {
          return pipe(
            discord.sendMessage(message.channel, 'pong'),
            Future.map(_ => Maybe.none)
          )
        }
      }
      return Future.right(Maybe.some(message))
    })
  )
}
