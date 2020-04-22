import * as Obs from 'fp-ts-rxjs/lib/ObservableEither'
import { Message } from 'discord.js'

import { PartialLogger } from './Logger'
import { DiscordConnector } from './DiscordConnector'
import { ObservableE } from '../models/ObservableE'
import { Maybe, pipe, Future } from '../utils/fp'
import { MessageUtils } from '../utils/MessageUtils'

export const Pong = (Logger: PartialLogger, discord: DiscordConnector) => (
  messages: ObservableE<Message>
): ObservableE<Maybe<Message>> => {
  const logger = Logger('Pong')

  return pipe(
    messages,
    Obs.chain(msg =>
      pipe(
        Obs.fromIOEither(logger.debug('got msg:', msg.content)),
        Obs.map(_ => msg)
      )
    ),
    Obs.chain(_ => pipe(replyPong(_), Obs.fromTaskEither))
  )

  // return none to prevent message from being passed to next message handler
  function replyPong(message: Message): Future<Maybe<Message>> {
    if (MessageUtils.isDm(message)) {
      if (message.content.trim() === 'ping') {
        return pipe(
          discord.sendMessage(message.channel, 'pong'),
          Future.map(_ => Maybe.none)
        )
      }
    }
    return Future.right(Maybe.some(message))
  }
}
