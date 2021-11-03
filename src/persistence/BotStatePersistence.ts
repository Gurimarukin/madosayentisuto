import { pipe } from 'fp-ts/function'

import { BotState, BotStateOutput } from '../models/BotState'
import { MongoCollection } from '../models/MongoCollection'
import { PartialLogger } from '../services/Logger'
import { Future, Maybe } from '../utils/fp'
import { FpCollection } from './FpCollection'

export type BotStatePersistence = ReturnType<typeof BotStatePersistence>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const BotStatePersistence = (Logger: PartialLogger, mongoCollection: MongoCollection) => {
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
        Future.map(r => r.modifiedCount + r.upsertedCount === 1),
      ),
  }
}
