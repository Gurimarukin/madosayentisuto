import { identity, pipe } from 'fp-ts/function'

import { StringUtils } from '../shared/utils/StringUtils'
import { Future } from '../shared/utils/fp'

import type { Config } from './Config'
import { constants } from './constants'
import { JwtHelper } from './helpers/JwtHelper'
import { YtDlp } from './helpers/YtDlp'
import type { LoggerObservable } from './models/logger/LoggerObservable'
import { MongoCollection } from './models/mongo/MongoCollection'
import { WithDb } from './models/mongo/WithDb'
import { BotStatePersistence } from './persistence/BotStatePersistence'
import { GuildStatePersistence } from './persistence/GuildStatePersistence'
import { HealthCheckPersistence } from './persistence/HealthCheckPersistence'
import { MemberBirthdatePersistence } from './persistence/MemberBirthdatePersistence'
import { MigrationPersistence } from './persistence/MigrationPersistence'
import { PollQuestionPersistence } from './persistence/PollQuestionPersistence'
import { PollResponsePersistence } from './persistence/PollResponsePersistence'
import { ScheduledEventPersistence } from './persistence/ScheduledEventPersistence'
import { UserPersistence } from './persistence/UserPersistence'
import { HealthCheckService } from './services/HealthCheckService'
import { MigrationService } from './services/MigrationService'

export type Context = ReturnType<typeof of>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const of = (
  config: Config,
  loggerObservable: LoggerObservable,
  withDb: WithDb,
  mongoCollection: (collName: string) => MongoCollection,
) => {
  const { Logger } = loggerObservable

  const botStatePersistence = BotStatePersistence(Logger, mongoCollection)
  const guildStatePersistence = GuildStatePersistence(Logger, mongoCollection)
  const healthCheckPersistence = HealthCheckPersistence(withDb)
  const memberBirthdatePersistence = MemberBirthdatePersistence(Logger, mongoCollection)
  const pollQuestionPersistence = PollQuestionPersistence(Logger, mongoCollection)
  const pollResponsePersistence = PollResponsePersistence(Logger, mongoCollection)
  const scheduledEventPersistence = ScheduledEventPersistence(Logger, mongoCollection)
  const userPersistence = UserPersistence(Logger, mongoCollection)

  const healthCheckService = HealthCheckService(healthCheckPersistence)

  const ytDlp = YtDlp(config.ytDlpPath)
  const jwtHelper = JwtHelper(config.jwtSecret)

  return {
    config,
    loggerObservable,
    botStatePersistence,
    guildStatePersistence,
    memberBirthdatePersistence,
    pollQuestionPersistence,
    pollResponsePersistence,
    scheduledEventPersistence,
    userPersistence,
    healthCheckService,
    ytDlp,
    jwtHelper,
  }
}

const load = (config: Config, loggerObservable: LoggerObservable): Future<Context> => {
  const { Logger } = loggerObservable
  const logger = Logger('Context')

  const withDb = WithDb.of({
    url: `mongodb://${config.db.user}:${config.db.password}@${config.db.host}`,
    dbName: config.db.dbName,
  })

  const mongoCollection: (collName: string) => MongoCollection = MongoCollection.fromWithDb(withDb)

  const context = of(config, loggerObservable, withDb, mongoCollection)
  const {
    guildStatePersistence,
    memberBirthdatePersistence,
    pollQuestionPersistence,
    pollResponsePersistence,
    scheduledEventPersistence,
    userPersistence,
    healthCheckService,
  } = context

  const migrationPersistence = MigrationPersistence(Logger, mongoCollection)

  const migrationService = MigrationService(Logger, mongoCollection, migrationPersistence)

  return pipe(
    logger.info('Ensuring indexes'),
    Future.fromIOEither,
    Future.chain(() => waitDatabaseReady()),
    Future.chain(() => migrationService.applyMigrations),
    Future.chain(() =>
      Future.sequenceArray([
        guildStatePersistence.ensureIndexes,
        memberBirthdatePersistence.ensureIndexes,
        pollQuestionPersistence.ensureIndexes,
        pollResponsePersistence.ensureIndexes,
        scheduledEventPersistence.ensureIndexes,
        userPersistence.ensureIndexes,
      ]),
    ),
    Future.chainIOEitherK(() => logger.info('Ensured indexes')),
    Future.map(() => context),
  )

  function waitDatabaseReady(): Future<boolean> {
    return pipe(
      healthCheckService.check(),
      Future.orElse(() =>
        pipe(
          logger.info(
            `Couldn't connect to mongo, waiting ${StringUtils.prettyMs(
              constants.dbRetryDelay,
            )} before next try`,
          ),
          Future.fromIOEither,
          Future.chain(() => pipe(waitDatabaseReady(), Future.delay(constants.dbRetryDelay))),
        ),
      ),
      Future.filterOrElse(identity, () => Error("HealthCheck wasn't success")),
    )
  }
}

export const Context = { load }
