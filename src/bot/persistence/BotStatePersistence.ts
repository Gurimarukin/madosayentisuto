import { FpCollection } from 'bot/helpers/FpCollection'
import type { BotStateOutput } from 'bot/models/botState/BotState'
import { BotState } from 'bot/models/botState/BotState'
import type { LoggerGetter } from 'bot/models/logger/LoggerType'
import type { MongoCollection } from 'bot/models/MongoCollection'
import { pipe } from 'fp-ts/function'
import { Future, Maybe } from 'shared/utils/fp'

export type BotStatePersistence = ReturnType<typeof BotStatePersistence>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const BotStatePersistence = (Logger: LoggerGetter, mongoCollection: MongoCollection) => {
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
