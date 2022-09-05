import { pipe } from 'fp-ts/function'

import { Future, Maybe } from '../../shared/utils/fp'

import { FpCollection } from '../helpers/FpCollection'
import { BotState } from '../models/botState/BotState'
import type { LoggerGetter } from '../models/logger/LoggerObservable'
import type { MongoCollectionGetter } from '../models/mongo/MongoCollection'

export type BotStatePersistence = ReturnType<typeof BotStatePersistence>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const BotStatePersistence = (
  Logger: LoggerGetter,
  mongoCollection: MongoCollectionGetter,
) => {
  const logger = Logger('BotStatePersistence')
  const collection = FpCollection(logger)([BotState.codec, 'BotState'])(mongoCollection('botState'))

  return {
    find: (): Future<BotState> =>
      pipe(collection.findOne({}), Future.map(Maybe.getOrElse(() => BotState.empty))),

    upsert: (state: BotState): Future<boolean> =>
      pipe(
        collection.updateOne({}, state, { upsert: true }),
        Future.map(r => r.modifiedCount + r.upsertedCount <= 1),
      ),
  }
}
