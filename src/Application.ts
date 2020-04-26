import { MongoClient, Collection } from 'mongodb'

import * as Obs from 'fp-ts-rxjs/lib/ObservableEither'
import { Subscription } from 'rxjs'

import { Config } from './config/Config'
import { ObservableE } from './models/ObservableE'
import { DiscordConnector } from './services/DiscordConnector'
import { PartialLogger } from './services/Logger'
import { MessagesHandler } from './services/MessagesHandler'
import { VoiceStateUpdatesHandler } from './services/VoiceStateUpdatesHandler'
import { IO, pipe, Either, Future, Try } from './utils/fp'
import { ReferentialService } from './services/ReferentialService'
import { ReferentialPersistence } from './persistence/ReferentialPersistence'

export const Application = (config: Config, discord: DiscordConnector): Future<void> => {
  const Logger = PartialLogger(config, discord)
  const logger = Logger('Application')

  const url = `mongodb://${config.db.user}:${config.db.password}@${config.db.host}`
  const mongoCollection = (coll: string): Future<Collection> =>
    pipe(
      Future.apply(() => new MongoClient(url, { useUnifiedTopology: true }).connect()),
      Future.map(_ => _.db(config.db.dbName).collection(coll))
    )

  const referentialPersistence = ReferentialPersistence(Logger, mongoCollection)

  return pipe(
    discord.setActivity(config.playingActivity),
    Future.chain(_ => ReferentialService(Logger, referentialPersistence)),
    Future.chain(referentialService => {
      const Logger = PartialLogger(config, discord)
      const logger = Logger('Application')

      const messagesHandler = MessagesHandler(Logger, config, discord, referentialService)
      const voiceStateUpdatesHandler = VoiceStateUpdatesHandler(Logger, referentialService, discord)

      return pipe(
        subscribe(messagesHandler, discord.messages()),
        IO.chain(_ => subscribe(voiceStateUpdatesHandler, discord.voiceStateUpdates())),
        IO.chain(_ => logger.info('application started')),
        Future.fromIOEither
      )
    })
  )

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
