import { pipe } from 'fp-ts/function'

import { DayJs } from '../../shared/models/DayJs'
import type { NotUsed } from '../../shared/utils/fp'
import { Future, IO, List, Maybe, NonEmptyArray } from '../../shared/utils/fp'
import { futureMaybe } from '../../shared/utils/futureMaybe'

import type { LoggerGetter } from '../models/logger/LoggerObservable'
import { Migration } from '../models/migration/Migration'
import type { MongoCollectionGetter } from '../models/mongo/MongoCollection'
import type { MigrationPersistence } from '../persistence/MigrationPersistence'
import { Migration202203281837 } from './migration/Migration202203281837'
import { Migration202204011827 } from './migration/Migration202204011827'
import { Migration202312062219 } from './migration/Migration202312062219'

export type MigrationService = ReturnType<typeof MigrationService>

export const MigrationService = (
  Logger: LoggerGetter,
  mongoCollection: MongoCollectionGetter,
  migrationPersistence: MigrationPersistence,
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
) => {
  const logger = Logger('MigrationService')

  const migrations: List<Migration> = [
    Migration202203281837(mongoCollection),
    Migration202204011827(mongoCollection),
    Migration202312062219(mongoCollection),
  ]

  const getUnappliedMigrations: Future<List<Migration>> = pipe(
    migrationPersistence.alreadyApplied,
    Future.map(applied =>
      pipe(
        migrations,
        List.filter(m => !pipe(applied, List.elem(DayJs.Eq)(m.createdAt))),
        List.sort(Migration.OrdCreatedAt),
      ),
    ),
  )

  const applyMigrations: Future<NotUsed> = pipe(
    getUnappliedMigrations,
    Future.map(NonEmptyArray.fromReadonlyArray),
    futureMaybe.chainFirstIOEitherK(m =>
      logger.info(`${m.length} migration${m.length === 1 ? '' : 's'} to apply`),
    ),
    futureMaybe.chainTaskEitherK(
      NonEmptyArray.traverse(Future.ApplicativeSeq)(migration =>
        pipe(
          logger.info(`Applying migration ${DayJs.toISOString(migration.createdAt)}`),
          Future.fromIOEither,
          Future.chain(() => migration.migrate),
          Future.chain(() => migrationPersistence.create(migration.createdAt)),
        ),
      ),
    ),
    Future.chainIOEitherK(
      Maybe.fold(
        () => logger.info('No migration to apply'),
        () => IO.notUsed,
      ),
    ),
  )

  return { applyMigrations }
}
