import { AppEvent } from '../models/AppEvent'
import { Subscribable } from '../models/pubSub'

import { PartialLogger } from './Logger'

export const Pong = (Logger: PartialLogger, eventBus: Subscribable<AppEvent.Message>): IO<void> => {
  const logger = Logger('Pong')

  return eventBus.subscribe('Pong.onMessage', onMessage)

  function onMessage(event: AppEvent.Message): Future<void> {
    if (event.name === 'dm-message') {
      if (event.message.content.trim() === 'ping') {
        return pipe(
          Future.apply(() => event.message.reply('pong')) as Future<void>,
          Future.orElse(e => Future.fromIOEither(logger.error('sending pong went wrong:', e)))
        )
      }
    }
    return Future.unit
  }
}
