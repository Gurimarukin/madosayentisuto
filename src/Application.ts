import * as Obs from 'fp-ts-rxjs/lib/ObservableEither'
import { Client } from 'discord.js'
import { Subscription } from 'rxjs'

import { DiscordConnector } from './services/DiscordConnector'
import { PartialLogger } from './services/Logger'
import { MessagesHandler } from './services/MessagesHandler'
import { Config } from './config/Config'
import { ObservableE } from './models/ObservableE'
import { Do, IO, pipe, Either, Future } from './utils/fp'

export const Application = (config: Config, client: Client): IO<void> => {
  const Logger = PartialLogger(config.logger, client.users)

  const logger = Logger('Application')

  const discord = DiscordConnector(client)

  const messageHandler = pipe(
    discord.messages,
    Obs.chain(_ =>
      pipe(
        Future.apply(() => Future.runUnsafe(MessagesHandler(Logger, config, discord)(_))),
        Obs.fromTaskEither
      )
    )
  )

  return Do(IO.ioEither)
    .bind('_1', logger.info('application started'))
    .bind('_2', subscribe(messageHandler))
    .return(() => {})

  function subscribe<A>(obs: ObservableE<A>): IO<Subscription> {
    return IO.apply(() =>
      obs.subscribe(_ =>
        pipe(
          _,
          Either.fold(
            e => pipe(logger.error(e.stack), IO.runUnsafe),
            _ => {}
          )
        )
      )
    )
  }
}
