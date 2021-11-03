import { flow, pipe } from 'fp-ts/function'

import { GuildId } from '../models/GuildId'
import { GuildState, GuildStateOnlyId, GuildStateOutput } from '../models/guildState/GuildState'
import { MongoCollection } from '../models/MongoCollection'
import { PartialLogger } from '../services/Logger'
import { Future, List, Maybe } from '../utils/fp'
import { FpCollection } from './FpCollection'

export type GuildStatePersistence = ReturnType<typeof GuildStatePersistence>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const GuildStatePersistence = (Logger: PartialLogger, mongoCollection: MongoCollection) => {
  const logger = Logger('GuildStatePersistence')
  const collection = FpCollection<GuildState, GuildStateOutput>(
    logger,
    mongoCollection('guildState'),
    [GuildState.codec, 'GuildState'],
  )

  return {
    ensureIndexes: (): Future<void> =>
      collection.ensureIndexes([{ key: { id: -1 }, unique: true }]),

    find: (id: GuildId): Future<Maybe<GuildState>> =>
      collection.findOne({ id: GuildId.unwrap(id) }),

    findAll: (): Future<List<GuildId>> =>
      pipe(
        collection.collection(coll => pipe(coll.find({}, { projection: { id: 1 } })).toArray()),
        Future.map(
          List.filterMap(
            flow(
              GuildStateOnlyId.codec.decode,
              Maybe.fromEither,
              Maybe.map(({ id }) => id),
            ),
          ),
        ),
      ),

    upsert: (id: GuildId, state: GuildState): Future<boolean> =>
      pipe(
        collection.updateOne({ id: GuildId.unwrap(id) }, state, { upsert: true }),
        Future.map(r => r.modifiedCount + r.upsertedCount === 1),
      ),
  }
}
