import { Client } from 'discord.js'

import { Pong } from './Pong'
import { EventBus } from './EventBus'
import { PartialLogger } from './Logger'
import { Config } from '../config/Config'
import { AppEvent } from '../models/AppEvent'
import { MessagesHandler } from './MessagesHandler'

export const Application = (initConfig: Config, client: Client): IO<void> => {
  const Logger = PartialLogger(initConfig.logger, client.users)

  const logger = Logger('Application')

  const eventBus = EventBus<AppEvent>(Logger, AppEvent.short)

  return (
    Do(IO.ioEither)
      /**
       * Handlers
       */
      .bind('_1', MessagesHandler(Logger, eventBus, client))

      /**
       * Services
       */
      .bind('_2', Pong(Logger, eventBus))

      .bind('_3', logger.info('application started'))
      .return(() => {})
  )
}
