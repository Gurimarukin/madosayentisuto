import { pipe } from 'fp-ts/function'

import { Future, Maybe } from '../../shared/utils/fp'

import { FpCollection } from '../helpers/FpCollection'
import type { BotStateOutput } from '../models/botState/BotState'
import { BotState } from '../models/botState/BotState'
import type { LoggerGetter } from '../models/logger/LoggerGetter'
import type { MongoCollection } from '../models/mongo/MongoCollection'

export type BotStatePersistence = ReturnType<typeof BotStatePersistence>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const BotStatePersistence = (
  Logger: LoggerGetter,
  mongoCollection: (collName: string) => MongoCollection,
) => {
  const logger = Logger('BotStatePersistence')
  const collection = FpCollection<BotState, BotStateOutput>(logger, mongoCollection('botState'), [
    BotState.codec,
    'BotState',
  ])

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
