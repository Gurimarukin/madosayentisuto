import { pipe } from 'fp-ts/function'

import { DayJs } from '../../shared/models/DayJs'
import type { List } from '../../shared/utils/fp'
import { Future } from '../../shared/utils/fp'

import { FpCollection } from '../helpers/FpCollection'
import type { LoggerGetter } from '../models/logger/LoggerGetter'
import { MigrationCreatedAt, MigrationDb } from '../models/migration/MigrationDb'
import type { MigrationDbOutput } from '../models/migration/MigrationDb'
import type { MongoCollection } from '../models/mongo/MongoCollection'
import { Sink } from '../models/rx/Sink'

export type MigrationPersistence = ReturnType<typeof MigrationPersistence>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const MigrationPersistence = (
  Logger: LoggerGetter,
  mongoCollection: (collName: string) => MongoCollection,
) => {
  const logger = Logger('MigrationPersistence')
  const collection = FpCollection<MigrationDb, MigrationDbOutput>(
    logger,
    mongoCollection('migration'),
    [MigrationDb.codec, 'MigrationDb'],
  )

  const alreadyApplied: Future<List<DayJs>> = pipe(
    collection.findAll([MigrationCreatedAt.decoder, 'MigrationCreatedAt'])(
      {},
      { projection: { createdAt: 1 } },
    ),
    Sink.readonlyArray,
  )

  return {
    create: (createdAt: DayJs): Future<boolean> =>
      pipe(
        DayJs.now,
        Future.fromIO,
        Future.chain(appliedAt => collection.insertOne({ createdAt, appliedAt })),
        Future.map(r => r.acknowledged),
      ),

    alreadyApplied,
  }
}
