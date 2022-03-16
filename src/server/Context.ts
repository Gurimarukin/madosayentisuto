import { task } from 'fp-ts'
import { pipe } from 'fp-ts/function'
import type { Collection, Db } from 'mongodb'
import { MongoClient } from 'mongodb'

import type { IO } from '../shared/utils/fp'
import { Future } from '../shared/utils/fp'

import type { Config } from './Config'
import type { DiscordConnector } from './helpers/DiscordConnector'
import { YtDlp } from './helpers/YtDlp'
import type { MongoCollection } from './models/MongoCollection'
import type { LoggerGetter, LoggerType } from './models/logger/LoggerType'
import { BotStatePersistence } from './persistence/BotStatePersistence'
import { GuildStatePersistence } from './persistence/GuildStatePersistence'
import { HealthCheckPersistence } from './persistence/HealthCheckPersistence'
import { PollResponsePersistence } from './persistence/PollResponsePersistence'
import { BotStateService } from './services/BotStateService'
import { GuildStateService } from './services/GuildStateService'
import { HealthCheckService } from './services/HealthCheckService'
import { PollResponseService } from './services/PollResponseService'
import { Routes } from './webServer/Routes'
import { DiscordClientController } from './webServer/controllers/DiscordClientController'
import { HealthCheckController } from './webServer/controllers/HealthCheckController'
import { WithAuth } from './webServer/controllers/WithAuth'
import { startWebServer } from './webServer/startWebServer'

export type Context = {
  readonly logger: LoggerType
  readonly ytDlp: YtDlp
  readonly ensureIndexes: Future<void>
  readonly botStateService: BotStateService
  readonly guildStateService: GuildStateService
  readonly pollResponseService: PollResponseService
  readonly startWebServer: IO<void>
}

const of = (Logger: LoggerGetter, config: Config, discord: DiscordConnector): Context => {
  const logger = Logger('Application')

  const ytDlp = YtDlp(config.ytDlpPath)

  const url = `mongodb://${config.db.user}:${config.db.password}@${config.db.host}`
  const withDb = <A>(f: (db: Db) => Promise<A>): Future<A> =>
    pipe(
      Future.tryCatch(() => MongoClient.connect(url)),
      Future.chain(client =>
        pipe(
          Future.tryCatch(() => f(client.db(config.db.dbName))),
          task.chain(either =>
            pipe(
              Future.tryCatch(() => client.close()),
              Future.orElse(e => Future.fromIOEither(logger.error('Failed to close client:\n', e))),
              task.map(() => either),
            ),
          ),
        ),
      ),
    )
  const mongoCollection: MongoCollection =
    (collName: string) =>
    <O, A>(f: (c: Collection<O>) => Promise<A>): Future<A> =>
      withDb(db => f(db.collection(collName)))

  const botStatePersistence = BotStatePersistence(Logger, mongoCollection)
  const guildStatePersistence = GuildStatePersistence(Logger, mongoCollection)
  const healthCheckPersistence = HealthCheckPersistence(withDb)
  const pollResponsePersistence = PollResponsePersistence(Logger, mongoCollection)

  const ensureIndexes = pipe(
    Future.sequenceArray([
      guildStatePersistence.ensureIndexes,
      pollResponsePersistence.ensureIndexes,
    ]),
    Future.map(() => {}),
  )

  const botStateService = BotStateService(Logger, discord, botStatePersistence)
  const guildStateService = GuildStateService(Logger, discord, ytDlp, guildStatePersistence)
  const healthCheckService = HealthCheckService(healthCheckPersistence)
  const pollResponseService = PollResponseService(pollResponsePersistence)

  const healthCheckController = HealthCheckController(healthCheckService)
  const discordClientController = DiscordClientController(discord)

  const withAuth = WithAuth()

  const routes = Routes(withAuth, healthCheckController, discordClientController)
  const startWebServer_ = startWebServer(Logger, config.http, routes)

  return {
    logger,
    ytDlp,
    ensureIndexes,
    botStateService,
    guildStateService,
    pollResponseService,
    startWebServer: startWebServer_,
  }
}

export const Context = { of }
