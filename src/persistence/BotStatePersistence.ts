import { Collection } from 'mongodb'

import { FpCollection } from './FpCollection'
import { BotState } from '../models/BotState'
import { PartialLogger } from '../services/Logger'
import { Future, pipe, Maybe } from '../utils/fp'

export const BotStatePersistence = (
  Logger: PartialLogger,
  mongoCollection: (dbName: string) => Future<Collection>
) => {
  const logger = Logger('BotStatePersistence')
  const collection = FpCollection(logger, () => mongoCollection('botState'), BotState.codec)

  return {
    find: (): Future<BotState> =>
      pipe(collection.findOne({}), Future.map(Maybe.getOrElse(() => BotState.empty))),

    upsert: (state: BotState): Future<boolean> =>
      pipe(
        collection.updateOne({}, state, { upsert: true }),
        Future.map(_ => _.modifiedCount + _.upsertedCount === 1)
      )
  }
}

export type BotStatePersistence = ReturnType<typeof BotStatePersistence>
