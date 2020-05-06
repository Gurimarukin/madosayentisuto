import { Collection } from 'mongodb'

import { FpCollection } from './FpCollection'
import { GuildId } from '../models/GuildId'
import { PartialLogger } from '../services/Logger'
import { Future, pipe, Maybe, Either, Task, List } from '../utils/fp'
import { GuildState } from '../models/GuildState'

export type GuildStatePersistence = ReturnType<typeof GuildStatePersistence>

export const GuildStatePersistence = (
  Logger: PartialLogger,
  mongoCollection: (dbName: string) => Future<Collection>
) => {
  const logger = Logger('GuildStatePersistence')
  const collection = FpCollection(logger, () => mongoCollection('guildState'), GuildState.codec)

  return {
    ensureIndexes: (): Future<void> =>
      collection.ensureIndexes([{ key: { id: -1 }, unique: true }]),

    find: (id: GuildId): Future<Maybe<GuildState>> => collection.findOne({ id }),

    findAll: (): Future<GuildId[]> =>
      pipe(
        collection.find({}),
        Future.map(_ => () => _.map(Either.map(_ => _.id)).toArray()),
        Future.chain(Task.map(List.array.sequence(Either.either)))
      ),

    upsert: (id: GuildId, state: GuildState): Future<boolean> =>
      pipe(
        collection.updateOne({ id }, { $set: state }, { upsert: true }),
        Future.map(_ => _.modifiedCount + _.upsertedCount === 1)
      )
  }
}
