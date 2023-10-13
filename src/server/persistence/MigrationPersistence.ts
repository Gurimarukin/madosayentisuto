import { pipe } from 'fp-ts/function'

import { DayJs } from '../../shared/models/DayJs'
import { Sink } from '../../shared/models/rx/Sink'
import type { List } from '../../shared/utils/fp'
import { Future } from '../../shared/utils/fp'

import { FpCollection } from '../helpers/FpCollection'
import type { LoggerGetter } from '../models/logger/LoggerObservable'
import { MigrationCreatedAt, MigrationDb } from '../models/migration/MigrationDb'
import type { MongoCollectionGetter } from '../models/mongo/MongoCollection'

export type MigrationPersistence = ReturnType<typeof MigrationPersistence>

export const MigrationPersistence = (
  Logger: LoggerGetter,
  mongoCollection: MongoCollectionGetter,
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
) => {
  const logger = Logger('MigrationPersistence')
  const collection = FpCollection(logger)([MigrationDb.codec, 'MigrationDb'])(
    mongoCollection('migration'),
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
