import { Message } from 'discord.js'
import * as Obs from 'fp-ts-rxjs/lib/ObservableEither'

import { PartialLogger } from './Logger'
import { DiscordConnector } from './DiscordConnector'
import { ObservableE } from '../models/ObservableE'
import { Maybe, pipe, Future } from '../utils/fp'

export const Pong = (
  Logger: PartialLogger,
  discord: DiscordConnector
): ObservableE<Maybe<unknown>> => {
  const _logger = Logger('Pong')

  return pipe(
    discord.messages,
    Obs.chain(message => pipe(replyPong(message), Obs.fromTaskEither))
  )

  function replyPong(message: Message): Future<Maybe<Message>> {
    const isFromSelf = pipe(
      discord.self(),
      Maybe.exists(_ => _.id === message.author.id)
    )

    if (!isFromSelf)
      if (message.channel.type === 'dm') {
        if (message.content.trim() === 'ping') {
          return pipe(discord.sendMessage(message.channel, 'pong'), Future.map(Maybe.some))
        }
      }
    return Future.right(Maybe.none)
  }
}
