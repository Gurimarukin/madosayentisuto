import { FpCollection } from 'bot/helpers/FpCollection'
import { GuildId } from 'bot/models/GuildId'
import type { GuildStateDbOutput } from 'bot/models/guildState/db/GuildStateDb'
import { GuildStateDb, GuildStateDbOnlyId } from 'bot/models/guildState/db/GuildStateDb'
import type { LoggerGetter } from 'bot/models/logger/LoggerType'
import type { MongoCollection } from 'bot/models/MongoCollection'
import { flow, pipe } from 'fp-ts/function'
import { Future, List, Maybe } from 'shared/utils/fp'

export type GuildStatePersistence = ReturnType<typeof GuildStatePersistence>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const GuildStatePersistence = (Logger: LoggerGetter, mongoCollection: MongoCollection) => {
  const logger = Logger('GuildStatePersistence')
  const collection = FpCollection<GuildStateDb, GuildStateDbOutput>(
    logger,
    mongoCollection('guildState'),
    [GuildStateDb.codec, 'GuildStateDb'],
  )

  return {
    ensureIndexes: (): Future<void> =>
      collection.ensureIndexes([{ key: { id: -1 }, unique: true }]),

    find: (id: GuildId): Future<Maybe<GuildStateDb>> =>
      collection.findOne({ id: GuildId.unwrap(id) }),

    findAll: (): Future<List<GuildId>> =>
      pipe(
        collection.collection(coll => pipe(coll.find({}, { projection: { id: 1 } })).toArray()),
        Future.map(
          List.filterMap(
            flow(
              GuildStateDbOnlyId.codec.decode,
              Maybe.fromEither,
              Maybe.map(({ id }) => id),
            ),
          ),
        ),
      ),

    upsert: (id: GuildId, state: GuildStateDb): Future<boolean> =>
      pipe(
        collection.updateOne({ id: GuildId.unwrap(id) }, state, { upsert: true }),
        Future.map(r => r.modifiedCount + r.upsertedCount === 1),
      ),
  }
}
