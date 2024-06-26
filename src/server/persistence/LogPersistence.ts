import { pipe } from 'fp-ts/function'
import * as C from 'io-ts/Codec'

import type { DayJs } from '../../shared/models/DayJs'
import type { Log } from '../../shared/models/log/Log'
import { LogLevelWithoutTrace } from '../../shared/models/log/LogLevel'
import type { NotUsed } from '../../shared/utils/fp'
import { Future, List } from '../../shared/utils/fp'

import { FpCollection } from '../helpers/FpCollection'
import type { LoggerGetter } from '../models/logger/LoggerObservable'
import type { MongoCollectionGetter } from '../models/mongo/MongoCollection'
import { DayJsFromDate } from '../utils/ioTsUtils'

const logMongoCodec = C.struct({
  date: DayJsFromDate.codec,
  name: C.string,
  level: LogLevelWithoutTrace.codec,
  message: C.string,
})

type ListArgs = {
  skip?: number
  limit?: number
}

export type LogPersistence = ReturnType<typeof LogPersistence>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function LogPersistence(Logger: LoggerGetter, mongoCollection: MongoCollectionGetter) {
  const logger = Logger('LogPersistence')
  const collection = FpCollection(logger)([logMongoCodec, 'ConsoleLog'])(mongoCollection('log'))

  const ensureIndexes: Future<NotUsed> = collection.ensureIndexes([{ key: { date: -1 } }])

  const count: Future<number> = collection.count({})

  return {
    ensureIndexes,

    count,

    list: ({ skip, limit }: ListArgs = {}): Future<List<Log>> =>
      collection.findAllArr()({}, { sort: [[collection.path(['date']), 1]], skip, limit }),

    insertMany: (logs: List<Log>): Future<number> =>
      !List.isNonEmpty(logs)
        ? Future.successful(0)
        : pipe(
            collection.insertMany(logs),
            Future.map(r => r.insertedCount),
          ),

    deleteBeforeDate: (date: DayJs): Future<number> =>
      pipe(
        collection.deleteMany({ date: { $lt: DayJsFromDate.encoder.encode(date) } }),
        Future.map(r => r.deletedCount),
      ),
  }
}
