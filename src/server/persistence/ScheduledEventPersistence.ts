import { pipe } from 'fp-ts/function'

import type { DayJs } from '../../shared/models/DayJs'
import type { NotUsed } from '../../shared/utils/fp'
import { Future, List, NonEmptyArray } from '../../shared/utils/fp'

import { FpCollection } from '../helpers/FpCollection'
import type { LoggerGetter } from '../models/logger/LoggerObservable'
import type { MongoCollectionGetter } from '../models/mongo/MongoCollection'
import { TObjectId } from '../models/mongo/TObjectId'
import { ScheduledEvent } from '../models/scheduledEvent/ScheduledEvent'
import { ScheduledEventWithId } from '../models/scheduledEvent/ScheduledEventWithId'
import { DayJsFromDate } from '../utils/ioTsUtils'

export type ScheduledEventPersistence = ReturnType<typeof ScheduledEventPersistence>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function ScheduledEventPersistence(
  Logger: LoggerGetter,
  mongoCollection: MongoCollectionGetter,
) {
  const logger = Logger('ScheduledEventPersistence')
  const collection = FpCollection(logger)([ScheduledEvent.codec, 'ScheduledEvent'])(
    mongoCollection('scheduledEvent'),
  )

  const ensureIndexes: Future<NotUsed> = collection.ensureIndexes([{ key: { scheduledAt: -1 } }])

  const list: Future<List<ScheduledEventWithId>> = collection.findAllArr([
    ScheduledEventWithId.decoder,
    'ScheduledEventWithId',
  ])({}, { sort: [[collection.path(['scheduledAt']), 1]] })

  return {
    ensureIndexes,

    listBeforeDate: (date: DayJs): Future<List<ScheduledEventWithId>> =>
      collection.findAllArr([ScheduledEventWithId.decoder, 'ScheduledEventWithId'])({
        scheduledAt: { $lte: DayJsFromDate.encoder.encode(date) },
      }),

    list,

    create: (event: ScheduledEvent): Future<boolean> =>
      pipe(
        collection.insertOne(event),
        Future.map(r => r.acknowledged),
      ),

    removeByIds: (ids: List<TObjectId>): Future<number> =>
      !List.isNonEmpty(ids)
        ? Future.successful(0)
        : pipe(
            collection.deleteMany({
              _id: { $in: NonEmptyArray.encoder(TObjectId.encoder).encode(ids) },
            }),
            Future.map(r => r.deletedCount),
          ),
  }
}
