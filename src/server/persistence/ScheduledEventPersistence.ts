import { pipe } from 'fp-ts/function'

import { Future } from '../../shared/utils/fp'

import { FpCollection } from '../helpers/FpCollection'
import type { LoggerGetter } from '../models/logger/LoggerGetter'
import type { MongoCollection } from '../models/mongo/MongoCollection'
import type { ScheduledEventOutput } from '../models/scheduledEvent/ScheduledEvent'
import { ScheduledEvent } from '../models/scheduledEvent/ScheduledEvent'

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

  // const ensureIndexes: Future<void> = collection.ensureIndexes([
  //   { key: { id: -1 }, unique: true },
  //   { key: { userName: -1 }, unique: true },
  // ])

  return {
    // ensureIndexes,

    // findByUserName: (userName: UserName): Future<Maybe<WebUser>> =>
    //   collection.findOne({ userName: UserName.codec.encode(userName) }),

    create: (event: ScheduledEvent): Future<boolean> =>
      pipe(
        collection.insertOne(event),
        Future.map(r => r.acknowledged),
      ),
  }
}
