import { pipe } from 'fp-ts/function'

import type { DayJs } from '../../shared/models/DayJs'
import type { NonEmptyArray } from '../../shared/utils/fp'
import { Future, List } from '../../shared/utils/fp'

import { FpCollection } from '../helpers/FpCollection'
import type { LoggerGetter } from '../models/logger/LoggerGetter'
import type { MongoCollection } from '../models/mongo/MongoCollection'
import { TObjectId } from '../models/mongo/TObjectId'
import type { TObservable } from '../models/rx/TObservable'
import type { ScheduledEventOutput } from '../models/scheduledEvent/ScheduledEvent'
import { ScheduledEvent } from '../models/scheduledEvent/ScheduledEvent'
import { ScheduledEventWithId } from '../models/scheduledEvent/ScheduledEventWithId'
import { DayJsFromDate } from '../utils/ioTsUtils'

export type ScheduledEventPersistence = ReturnType<typeof ScheduledEventPersistence>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function ScheduledEventPersistence(
  Logger: LoggerGetter,
  mongoCollection: (collName: string) => MongoCollection,
) {
  const logger = Logger('ScheduledEventPersistence')
  const collection = FpCollection<ScheduledEvent, ScheduledEventOutput>(
    logger,
    mongoCollection('scheduledEvent'),
    [ScheduledEvent.codec, 'ScheduledEvent'],
  )

  const ensureIndexes: Future<void> = collection.ensureIndexes([{ key: { scheduledAt: -1 } }])

  return {
    ensureIndexes,

    listBeforeDate: (date: DayJs): TObservable<ScheduledEventWithId> =>
      collection.findAll([ScheduledEventWithId.decoder, 'ScheduledEventWithId'])({
        scheduledAt: { $lte: DayJsFromDate.encoder.encode(date) },
      }),

    create: (event: ScheduledEvent): Future<boolean> =>
      pipe(
        collection.insertOne(event),
        Future.map(r => r.acknowledged),
      ),

    removeByIds: (ids: NonEmptyArray<TObjectId>): Future<number> =>
      pipe(
        collection.deleteMany({ _id: { $in: List.encoder(TObjectId.encoder).encode(ids) } }),
        Future.map(r => r.deletedCount),
      ),
  }
}