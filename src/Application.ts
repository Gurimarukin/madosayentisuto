import * as Obs from 'fp-ts-rxjs/lib/ObservableEither'
import { Client } from 'discord.js'
import { Subscription } from 'rxjs'

import { Config } from './config/Config'
import { ObservableE } from './models/ObservableE'
import { DiscordConnector } from './services/DiscordConnector'
import { PartialLogger } from './services/Logger'
import { MessagesHandler } from './services/MessagesHandler'
import { VoiceStateUpdatesHandler } from './services/VoiceStateUpdatesHandler'
import { Do, IO, pipe, Either, Future, Try } from './utils/fp'
import { ReferentialService } from './services/ReferentialService'

export const Application = (config: Config, client: Client): IO<void> => {
  const Logger = PartialLogger(config.logger, client.users)

  const logger = Logger('Application')

  const referentialService = ReferentialService(Logger)

  const discord = DiscordConnector(client)

  const messagesHandler = MessagesHandler(Logger, config, discord)
  const voiceStateUpdatesHandler = VoiceStateUpdatesHandler(Logger, referentialService, discord)

  return Do(IO.ioEither)
    .bind('_1', logger.info('application started'))
    .bind('_2', subscribe(messagesHandler, discord.messages))
    .bind('_3', subscribe(voiceStateUpdatesHandler, discord.voiceStateUpdates))
    .return(() => {})

  function subscribe<A>(f: (a: A) => Future<unknown>, a: ObservableE<A>): IO<Subscription> {
    const obs = pipe(
      a,
      Obs.chain(_ =>
        pipe(
          Try.apply(() => f(_)),
          Future.fromEither,
          Future.chain(f => Future.apply(() => Future.runUnsafe(f))),
          Obs.fromTaskEither
        )
      )
    )
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
