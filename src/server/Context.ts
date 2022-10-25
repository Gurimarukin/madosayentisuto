import { pipe } from 'fp-ts/function'

import { StringUtils } from '../shared/utils/StringUtils'
import { Future, NonEmptyArray } from '../shared/utils/fp'

import type { Config } from './config/Config'
import { Resources } from './config/Resources'
import { constants } from './config/constants'
import { JwtHelper } from './helpers/JwtHelper'
import { ResourcesHelper } from './helpers/ResourcesHelper'
import { YtDlp } from './helpers/YtDlp'
import type { LoggerObservable } from './models/logger/LoggerObservable'
import { MongoCollectionGetter } from './models/mongo/MongoCollection'
import { WithDb } from './models/mongo/WithDb'
import { BotStatePersistence } from './persistence/BotStatePersistence'
import { GuildStatePersistence } from './persistence/GuildStatePersistence'
import { HealthCheckPersistence } from './persistence/HealthCheckPersistence'
import { LogPersistence } from './persistence/LogPersistence'
import { MemberBirthdatePersistence } from './persistence/MemberBirthdatePersistence'
import { MigrationPersistence } from './persistence/MigrationPersistence'
import { PollQuestionPersistence } from './persistence/PollQuestionPersistence'
import { PollResponsePersistence } from './persistence/PollResponsePersistence'
import { ScheduledEventPersistence } from './persistence/ScheduledEventPersistence'
import { UserPersistence } from './persistence/UserPersistence'
import { HealthCheckService } from './services/HealthCheckService'
import { MigrationService } from './services/MigrationService'
import { getOnError } from './utils/getOnError'

export type Context = ReturnType<typeof of>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const of = (
  config: Config,
  resources: Resources,
  loggerObservable: LoggerObservable,
  withDb: WithDb,
  mongoCollection: MongoCollectionGetter,
) => {
  const { Logger } = loggerObservable

  const botStatePersistence = BotStatePersistence(Logger, mongoCollection)
  const logPersistence = LogPersistence(Logger, mongoCollection)
  const guildStatePersistence = GuildStatePersistence(Logger, mongoCollection)
  const healthCheckPersistence = HealthCheckPersistence(withDb)
  const memberBirthdatePersistence = MemberBirthdatePersistence(Logger, mongoCollection)
  const pollQuestionPersistence = PollQuestionPersistence(Logger, mongoCollection)
  const pollResponsePersistence = PollResponsePersistence(Logger, mongoCollection)
  const scheduledEventPersistence = ScheduledEventPersistence(Logger, mongoCollection)
  const userPersistence = UserPersistence(Logger, mongoCollection)

  const healthCheckService = HealthCheckService(healthCheckPersistence)

  const jwtHelper = JwtHelper(config.jwtSecret)
  const resourcesHelper = ResourcesHelper.of(resources)
  const ytDlp = YtDlp(config.ytDlpPath)

  return {
    config,
    loggerObservable,
    botStatePersistence,
    logPersistence,
    guildStatePersistence,
    memberBirthdatePersistence,
    pollQuestionPersistence,
    pollResponsePersistence,
    scheduledEventPersistence,
    userPersistence,
    healthCheckService,
    jwtHelper,
    resourcesHelper,
    ytDlp,
  }
}

const load = (config: Config, loggerObservable: LoggerObservable): Future<Context> => {
  const { Logger } = loggerObservable
  const logger = Logger('Context')

  return pipe(Resources.load, Future.chain(loadContext))

  function loadContext(resources: Resources): Future<Context> {
    const withDb = WithDb.of(getOnError(logger), {
      url: `mongodb://${config.db.user}:${config.db.password}@${config.db.host}`,
      dbName: config.db.dbName,
    })

    const mongoCollection: MongoCollectionGetter = MongoCollectionGetter.fromWithDb(withDb)

    const context = of(config, resources, loggerObservable, withDb, mongoCollection)
    const {
      guildStatePersistence,
      logPersistence,
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
      Future.chain(() => waitDatabaseReady(healthCheckService)),
      Future.chain(() => migrationService.applyMigrations),
      Future.chain(() =>
        NonEmptyArray.sequence(Future.ApplicativeSeq)([
          guildStatePersistence.ensureIndexes,
          logPersistence.ensureIndexes,
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
  }

  function waitDatabaseReady(healthCheckService: HealthCheckService): Future<boolean> {
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
          Future.chain(() =>
            pipe(waitDatabaseReady(healthCheckService), Future.delay(constants.dbRetryDelay)),
          ),
        ),
      ),
      Future.filterOrElse(
        success => success,
        () => Error("HealthCheck wasn't success"),
      ),
    )
  }
}

export const Context = { load }
