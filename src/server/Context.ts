import { task } from 'fp-ts'
import { pipe } from 'fp-ts/function'
import type { Collection, Db } from 'mongodb'
import { MongoClient } from 'mongodb'

import { toUnit } from '../shared/utils/fp'
import { Future } from '../shared/utils/fp'

import type { Config } from './Config'
import type { DiscordConnector } from './helpers/DiscordConnector'
import { YtDlp } from './helpers/YtDlp'
import type { LoggerGetter } from './models/logger/LoggerType'
import type { MongoCollection } from './models/mongo/MongoCollection'
import { BotStatePersistence } from './persistence/BotStatePersistence'
import { GuildStatePersistence } from './persistence/GuildStatePersistence'
import { HealthCheckPersistence } from './persistence/HealthCheckPersistence'
import { MemberBirthdatePersistence } from './persistence/MemberBirthdatePersistence'
import { MigrationPersistence } from './persistence/MigrationPersistence'
import { PollQuestionPersistence } from './persistence/PollQuestionPersistence'
import { PollResponsePersistence } from './persistence/PollResponsePersistence'
import { BotStateService } from './services/BotStateService'
import { GuildStateService } from './services/GuildStateService'
import { HealthCheckService } from './services/HealthCheckService'
import { MemberBirthdateService } from './services/MemberBirthdateService'
import { MigrationService } from './services/MigrationService'
import { PollService } from './services/PollService'
import { Routes } from './webServer/Routes'
import { DiscordClientController } from './webServer/controllers/DiscordClientController'
import { HealthCheckController } from './webServer/controllers/HealthCheckController'
import { startWebServer as getStartWebServer } from './webServer/startWebServer'
import { WithAuth } from './webServer/utils/WithAuth'

export type Context = ReturnType<typeof of>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const of = (Logger: LoggerGetter, config: Config, discord: DiscordConnector) => {
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
  const memberBirthdatePersistence = MemberBirthdatePersistence(Logger, mongoCollection)
  const migrationPersistence = MigrationPersistence(Logger, mongoCollection)
  const pollResponsePersistence = PollResponsePersistence(Logger, mongoCollection)
  const pollQuestionPersistence = PollQuestionPersistence(Logger, mongoCollection)

  const ensureIndexes = pipe(
    Future.sequenceArray([
      guildStatePersistence.ensureIndexes,
      memberBirthdatePersistence.ensureIndexes,
      pollQuestionPersistence.ensureIndexes,
      pollResponsePersistence.ensureIndexes,
    ]),
    Future.map(toUnit),
  )

  const botStateService = BotStateService(Logger, discord, botStatePersistence)
  const guildStateService = GuildStateService(Logger, discord, ytDlp, guildStatePersistence)
  const healthCheckService = HealthCheckService(healthCheckPersistence)
  const memberBirthdateService = MemberBirthdateService(memberBirthdatePersistence)
  const migrationService = MigrationService(Logger, mongoCollection, migrationPersistence)
  const pollService = PollService(pollQuestionPersistence, pollResponsePersistence)

  const healthCheckController = HealthCheckController(healthCheckService)
  const discordClientController = DiscordClientController(discord, memberBirthdateService)

  const withAuth = WithAuth({ isDisabled: config.http.disableAuth })

  const routes = Routes(withAuth, healthCheckController, discordClientController)
  const startWebServer = getStartWebServer(Logger, config.http, routes)

  return {
    logger,
    ytDlp,
    ensureIndexes,
    botStateService,
    guildStateService,
    healthCheckService,
    memberBirthdateService,
    migrationService,
    pollService,
    startWebServer,
  }
}

export const Context = { of }
