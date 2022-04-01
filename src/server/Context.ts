import { task } from 'fp-ts'
import { identity, pipe } from 'fp-ts/function'
import type { Collection, Db } from 'mongodb'
import { MongoClient } from 'mongodb'

import { MsDuration } from '../shared/models/MsDuration'
import { StringUtils } from '../shared/utils/StringUtils'
import { Future } from '../shared/utils/fp'

import type { Config } from './Config'
import { JwtHelper } from './helpers/JwtHelper'
import { YtDlp } from './helpers/YtDlp'
import type { LoggerGetter } from './models/logger/LoggerGetter'
import type { MongoCollection } from './models/mongo/MongoCollection'
import { BotStatePersistence } from './persistence/BotStatePersistence'
import { GuildStatePersistence } from './persistence/GuildStatePersistence'
import { HealthCheckPersistence } from './persistence/HealthCheckPersistence'
import { MemberBirthdatePersistence } from './persistence/MemberBirthdatePersistence'
import { MigrationPersistence } from './persistence/MigrationPersistence'
import { PollQuestionPersistence } from './persistence/PollQuestionPersistence'
import { PollResponsePersistence } from './persistence/PollResponsePersistence'
import { UserPersistence } from './persistence/UserPersistence'
import { HealthCheckService } from './services/HealthCheckService'
import { MigrationService } from './services/MigrationService'

type WithDb = <A>(f: (db: Db) => Promise<A>) => Future<A>

export type Context = ReturnType<typeof of>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const of = (
  config: Config,
  Logger: LoggerGetter,
  withDb: WithDb,
  mongoCollection: MongoCollection,
) => {
  const botStatePersistence = BotStatePersistence(Logger, mongoCollection)
  const guildStatePersistence = GuildStatePersistence(Logger, mongoCollection)
  const healthCheckPersistence = HealthCheckPersistence(withDb)
  const memberBirthdatePersistence = MemberBirthdatePersistence(Logger, mongoCollection)
  const pollResponsePersistence = PollResponsePersistence(Logger, mongoCollection)
  const pollQuestionPersistence = PollQuestionPersistence(Logger, mongoCollection)
  const userPersistence = UserPersistence(Logger, mongoCollection)

  const healthCheckService = HealthCheckService(healthCheckPersistence)

  const ytDlp = YtDlp(config.ytDlpPath)
  const jwtHelper = JwtHelper(config.jwtSecret)

  return {
    config,
    Logger,
    botStatePersistence,
    guildStatePersistence,
    memberBirthdatePersistence,
    pollResponsePersistence,
    pollQuestionPersistence,
    userPersistence,
    healthCheckService,
    ytDlp,
    jwtHelper,
  }
}

const dbRetryDelay = MsDuration.seconds(10)

const load = (config: Config, Logger: LoggerGetter): Future<Context> => {
  const logger = Logger('Context')

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

  const context = of(config, Logger, withDb, mongoCollection)
  const {
    guildStatePersistence,
    memberBirthdatePersistence,
    pollResponsePersistence,
    pollQuestionPersistence,
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
              dbRetryDelay,
            )} before next try`,
          ),
          Future.fromIOEither,
          Future.chain(() => pipe(waitDatabaseReady(), Future.delay(dbRetryDelay))),
        ),
      ),
      Future.filterOrElse(identity, () => Error("HealthCheck wasn't success")),
    )
  }
}

export const Context = { load }
