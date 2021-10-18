import { GuildId } from '../models/GuildId'
import { GuildState } from '../models/guildState/GuildState'
import { MongoCollection } from '../models/MongoCollection'
import { PartialLogger } from '../services/Logger'
import { Either, Future, List, Maybe, Task, pipe } from '../utils/fp'
import { FpCollection } from './FpCollection'

export const GuildStatePersistence = (Logger: PartialLogger, mongoCollection: MongoCollection) => {
  const logger = Logger('GuildStatePersistence')
  const collection = FpCollection<GuildState, GuildState.Output>(
    logger,
    mongoCollection('guildState'),
    GuildState.codec,
  )

  return {
    ensureIndexes: (): Future<void> =>
      collection.ensureIndexes([{ key: { id: -1 }, unique: true }]),

    find: (id: GuildId): Future<Maybe<GuildState>> =>
      collection.findOne({ id: GuildId.unwrap(id) }),

    findAll: (): Future<ReadonlyArray<GuildId>> =>
      pipe(
        collection.find({}),
        Future.map(_ => () => _.map(Either.map(_ => _.id)).toArray()),
        Future.chain(Task.map(List.array.sequence(Either.either))),
      ),

    upsert: (id: GuildId, state: GuildState): Future<boolean> =>
      pipe(
        collection.updateOne({ id: GuildId.unwrap(id) }, state, { upsert: true }),
        Future.map(_ => _.modifiedCount + _.upsertedCount === 1),
      ),
  }
}

export type GuildStatePersistence = ReturnType<typeof GuildStatePersistence>
