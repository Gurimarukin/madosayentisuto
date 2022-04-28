import { pipe } from 'fp-ts/function'
import * as C from 'io-ts/Codec'

import type { DayJs } from '../../shared/models/DayJs'
import type { Log } from '../../shared/models/log/Log'
import { LogLevel } from '../../shared/models/log/LogLevel'
import type { TObservable } from '../../shared/models/rx/TObservable'
import type { List } from '../../shared/utils/fp'
import { Future } from '../../shared/utils/fp'

import { FpCollection } from '../helpers/FpCollection'
import type { LoggerGetter } from '../models/logger/LoggerObservable'
import type { MongoCollection } from '../models/mongo/MongoCollection'
import { DayJsFromDate } from '../utils/ioTsUtils'

const logMongoCodec = C.struct({
  date: DayJsFromDate.codec,
  name: C.string,
  level: LogLevel.codec,
  message: C.string,
})
type LogMongoOutput = C.OutputOf<typeof logMongoCodec>

type ListArgs = {
  readonly skip?: number
  readonly limit?: number
}

export type LogPersistence = ReturnType<typeof LogPersistence>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function LogPersistence(
  Logger: LoggerGetter,
  mongoCollection: (collName: string) => MongoCollection,
) {
  const logger = Logger('LogPersistence')
  const collection = FpCollection<Log, LogMongoOutput>(logger, mongoCollection('log'), [
    logMongoCodec,
    'ConsoleLog',
  ])

  const ensureIndexes: Future<void> = collection.ensureIndexes([{ key: { date: -1 } }])

  const countAll: Future<number> = collection.count({})
  const countNonDebug: Future<number> = collection.count({ level: { $ne: 'debug' } })

  return {
    ensureIndexes,

    countAll,
    countNonDebug,

    list: ({ skip, limit }: ListArgs = {}): TObservable<Log> =>
      collection.findAll()(
        { level: { $ne: 'debug' } },
        { sort: [[collection.path(['date']), 1]], skip, limit },
      ),

    insertMany: (logs: List<Log>): Future<number> =>
      pipe(
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
