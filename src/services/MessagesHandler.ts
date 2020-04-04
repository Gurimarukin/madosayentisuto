import { Client, Message } from 'discord.js'

import { PartialLogger } from './Logger'
import { Publishable } from '../models/pubSub'
import { AppEvent } from '../models/AppEvent'

export const MessagesHandler = (
  Logger: PartialLogger,
  eventBus: Publishable<AppEvent.Message>,
  client: Client
): IO<void> => {
  const _logger = Logger('MessagesHandler')

  return IO.apply(() =>
    client.on('message', message => IO.runUnsafe(handleMessage(message)))
  ) as IO<void>

  function handleMessage(message: Message): IO<void> {
    return pipe(
      eventFromMessage(message),
      Maybe.fold(
        () => IO.unit,
        _ => IO.apply(() => eventBus.publish(_))
      )
    )
  }
}

function eventFromMessage(message: Message): Maybe<AppEvent.Message> {
  if (message.channel.type === 'dm') return Maybe.some(AppEvent.Message.dmMessage(message))
  if (message.channel.type === 'text') return Maybe.some(AppEvent.Message.guildMessage(message))
  return Maybe.none
}
