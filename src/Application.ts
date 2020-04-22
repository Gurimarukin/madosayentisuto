import * as io from 'fp-ts/lib/IO'

import * as O from 'fp-ts-rxjs/lib/Observable'
import * as Obs from 'fp-ts-rxjs/lib/ObservableEither'
import { Client } from 'discord.js'
import { Subscription } from 'rxjs'

import { DiscordConnector } from './services/DiscordConnector'
import { PartialLogger } from './services/Logger'
import { CmdHandler } from './services/CmdHandler'
import { Pong } from './services/Pong'
import { Config } from './config/Config'
import { ObservableE } from './models/ObservableE'
import { Do, IO, Try, pipe, Either, List, Maybe, todo, Future } from './utils/fp'

export const Application = (config: Config, client: Client): IO<void> => {
  const Logger = PartialLogger(config.logger, client.users)

  const logger = Logger('Application')

  const discord = DiscordConnector(client)

  const messageHandlers = [Pong(Logger, discord), CmdHandler(Logger, config, discord)]
  const messagesFromOthers = pipe(
    discord.messages,
    O.filter(_ =>
      pipe(
        _,
        Either.exists(_ => !discord.isFromSelf(_))
      )
    )
  )
  const messagesFlow = pipe(
    messageHandlers,
    List.reduce(messagesFromOthers, (messages, f) =>
      pipe(
        messages,
        Obs.chain(_ =>
          pipe(
            Future.apply(() => Future.runUnsafe(f(_))),
            Obs.fromTaskEither,
            Obs.chain(_ => pipe(O.fromOption(_), O.map(Try.right)))
          )
        )
      )
    )
  )

  return Do(IO.ioEither)
    .bind('_1', logger.info('application started'))
    .bind('_2', subscribe(messagesFlow))
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
