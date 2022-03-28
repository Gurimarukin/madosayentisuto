import { pipe } from 'fp-ts/function'

import { GuildId } from '../../shared/models/guild/GuildId'
import type { Dict, Maybe } from '../../shared/utils/fp'
import { Future, List } from '../../shared/utils/fp'

import { FpCollection } from '../helpers/FpCollection'
import type { ChannelId } from '../models/ChannelId'
import type { GuildStateDbOutput } from '../models/guildState/db/GuildStateDb'
import {
  GuildStateDb,
  GuildStateDbOnlyItsFridayChannel,
} from '../models/guildState/db/GuildStateDb'
import type { LoggerGetter } from '../models/logger/LoggerType'
import type { MongoCollection } from '../models/mongo/MongoCollection'

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

  const ensureIndexes: Future<void> = collection.ensureIndexes([{ key: { id: -1 }, unique: true }])

  return {
    ensureIndexes,

    find: (id: GuildId): Future<Maybe<GuildStateDb>> =>
      collection.findOne({ id: GuildId.unwrap(id) }),

    listAllItsFridayChannels: (): Future<List<ChannelId>> => {
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

    upsert: (state: GuildStateDb): Future<boolean> =>
      pipe(
        collection.updateOne({ id: GuildId.unwrap(state.id) }, state, { upsert: true }),
        Future.map(r => r.modifiedCount + r.upsertedCount <= 1),
      ),
  }
}
