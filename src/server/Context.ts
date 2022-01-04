import { task } from 'fp-ts'
import { pipe } from 'fp-ts/function'
import type { Collection } from 'mongodb'
import { MongoClient } from 'mongodb'

import type { IO } from '../shared/utils/fp'
import { Future } from '../shared/utils/fp'

import type { Config } from './Config'
import type { DiscordConnector } from './helpers/DiscordConnector'
import { YoutubeDl } from './helpers/YoutubeDl'
import type { MongoCollection } from './models/MongoCollection'
import type { LoggerGetter, LoggerType } from './models/logger/LoggerType'
import { BotStatePersistence } from './persistence/BotStatePersistence'
import { GuildStatePersistence } from './persistence/GuildStatePersistence'
import { BotStateService } from './services/BotStateService'
import { GuildStateService } from './services/GuildStateService'
import { Routes } from './webServer/Routes'
import { DiscordClientController } from './webServer/controllers/DiscordClientController'
import { startWebServer } from './webServer/startWebServer'

export type Context = {
  readonly logger: LoggerType
  readonly youtubeDl: YoutubeDl
  readonly ensureIndexes: Future<void>
  readonly botStateService: BotStateService
  readonly guildStateService: GuildStateService
  readonly startWebServer: IO<void>
}

const of = (Logger: LoggerGetter, config: Config, discord: DiscordConnector): Context => {
  const logger = Logger('Application')

  const youtubeDl = YoutubeDl(config.youtubeDlPath)

  const url = `mongodb://${config.db.user}:${config.db.password}@${config.db.host}`
  const mongoCollection: MongoCollection =
    (collName: string) =>
    <O, A>(f: (c: Collection<O>) => Promise<A>): Future<A> =>
      pipe(
        Future.tryCatch(() => MongoClient.connect(url)),
        Future.chain(client =>
          pipe(
            Future.tryCatch(() => f(client.db(config.db.dbName).collection(collName))),
            task.chain(either =>
              pipe(
                Future.tryCatch(() => client.close()),
                Future.orElse(e =>
                  Future.fromIOEither(logger.error('Failed to close client:\n', e)),
                ),
                task.map(() => either),
              ),
            ),
          ),
        ),
      )

  const botStatePersistence = BotStatePersistence(Logger, mongoCollection)
  const guildStatePersistence = GuildStatePersistence(Logger, mongoCollection)

  const ensureIndexes = pipe(
    Future.sequenceArray([guildStatePersistence.ensureIndexes]),
    Future.map(() => {}),
  )

  const botStateService = BotStateService(Logger, discord, botStatePersistence)
  const guildStateService = GuildStateService(Logger, discord, youtubeDl, guildStatePersistence)

  const discordClientController = DiscordClientController(discord)

  const routes = Routes(discordClientController)
  const startWebServer_ = startWebServer(Logger, config.http, routes)

  return {
    logger,
    youtubeDl,
    ensureIndexes,
    botStateService,
    guildStateService,
    startWebServer: startWebServer_,
  }
}

export const Context = { of }
