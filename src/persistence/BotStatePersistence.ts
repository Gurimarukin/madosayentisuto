import { Collection } from 'mongodb'

import { BotState } from '../models/BotState'
import { PartialLogger } from '../services/Logger'
import { Future, Maybe, pipe } from '../utils/fp'
import { FpCollection } from './FpCollection'

export const BotStatePersistence = (
  Logger: PartialLogger,
  mongoCollection: (collName: string) => <A>(f: (coll: Collection) => Promise<A>) => Future<A>
) => {
  const logger = Logger('BotStatePersistence')
  const collection = FpCollection<BotState, BotState.Output>(
    logger,
    mongoCollection('botState'),
    BotState.codec
  )

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
