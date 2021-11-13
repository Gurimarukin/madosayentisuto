import { pipe } from 'fp-ts/function'

import type { Dict, Maybe } from '../../shared/utils/fp'
import { Future, List } from '../../shared/utils/fp'

import { FpCollection } from '../helpers/FpCollection'
import { GuildId } from '../models/GuildId'
import type { MongoCollection } from '../models/MongoCollection'
import type { TSnowflake } from '../models/TSnowflake'
import type { GuildStateDbOutput } from '../models/guildState/db/GuildStateDb'
import {
  GuildStateDb,
  GuildStateDbOnlyId,
  GuildStateDbOnlyItsFridayChannel,
} from '../models/guildState/db/GuildStateDb'
import type { LoggerGetter } from '../models/logger/LoggerType'

type Projection = Partial<Dict<keyof GuildStateDbOutput, 1>>

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

    findAllIds: (): Future<List<GuildId>> => {
      const projection: Projection = { id: 1 }
      return pipe(
        collection.findAll([GuildStateDbOnlyId.codec, 'GuildStateDbOnlyId'])({}, { projection }),
        Future.map(List.map(({ id }) => id)),
      )
    },

    findAllItsFridayChannels: (): Future<List<TSnowflake>> => {
      const projection: Projection = { itsFridayChannel: 1 }
      return pipe(
        collection.findAll([
          GuildStateDbOnlyItsFridayChannel.codec,
          'GuildStateDbOnlyItsFridayChannel',
        ])(
          { $and: [{ itsFridayChannel: { $exists: true } }, { itsFridayChannel: { $ne: null } }] },
          { projection },
        ),
        Future.map(List.map(({ itsFridayChannel }) => itsFridayChannel)),
      )
    },

    upsert: (id: GuildId, state: GuildStateDb): Future<boolean> =>
      pipe(
        collection.updateOne({ id: GuildId.unwrap(id) }, state, { upsert: true }),
        Future.map(r => r.modifiedCount + r.upsertedCount === 1),
      ),
  }
}
