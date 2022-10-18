import { pipe } from 'fp-ts/function'

import { DayJs } from '../../shared/models/DayJs'
import type { NotUsed } from '../../shared/models/NotUsed'
import { Future, IO, List, Maybe, NonEmptyArray } from '../../shared/utils/fp'
import { futureMaybe } from '../../shared/utils/futureMaybe'

import type { LoggerGetter } from '../models/logger/LoggerObservable'
import { Migration } from '../models/migration/Migration'
import type { MongoCollectionGetter } from '../models/mongo/MongoCollection'
import type { MigrationPersistence } from '../persistence/MigrationPersistence'
import { Migration202203281837 } from './migration/Migration202203281837'
import { Migration202204011827 } from './migration/Migration202204011827'

export type MigrationService = ReturnType<typeof MigrationService>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const MigrationService = (
  Logger: LoggerGetter,
  mongoCollection: MongoCollectionGetter,
  migrationPersistence: MigrationPersistence,
) => {
  const logger = Logger('MigrationService')

  const migrations: List<Migration> = [
    Migration202203281837(mongoCollection),
    Migration202204011827(mongoCollection),
  ]

  const applyMigrations: Future<NotUsed> = pipe(
    getUnappliedMigrations(),
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

  function getUnappliedMigrations(): Future<List<Migration>> {
    return pipe(
      migrationPersistence.alreadyApplied,
      Future.map(applied =>
        pipe(
          migrations,
          List.filter(m => !pipe(applied, List.elem(DayJs.Eq)(m.createdAt))),
          List.sort(Migration.OrdCreatedAt),
        ),
      ),
    )
  }
}
