import { pipe } from 'fp-ts/function'

import { GuildId } from '../../shared/models/guild/GuildId'
import type { Dict, List, Maybe } from '../../shared/utils/fp'
import { Future } from '../../shared/utils/fp'

import { FpCollection } from '../helpers/FpCollection'
import type { ChannelId } from '../models/ChannelId'
import type { GuildStateDbOutput } from '../models/guildState/db/GuildStateDb'
import {
  GuildStateDb,
  GuildStateDbOnlyItsFridayChannel,
} from '../models/guildState/db/GuildStateDb'
import type { LoggerGetter } from '../models/logger/LoggerGetter'
import type { MongoCollection } from '../models/mongo/MongoCollection'
import { Sink } from '../models/rx/Sink'
import { TObservable } from '../models/rx/TObservable'

type Projection = Partial<Dict<keyof GuildStateDbOutput, 1>>

export type GuildStatePersistence = ReturnType<typeof GuildStatePersistence>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const GuildStatePersistence = (
  Logger: LoggerGetter,
  mongoCollection: (collName: string) => MongoCollection,
) => {
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
      collection.findOne({ id: GuildId.codec.encode(id) }),

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
        TObservable.map(({ itsFridayChannel }) => itsFridayChannel),
        Sink.readonlyArray,
      )
    },

    upsert: (state: GuildStateDb): Future<boolean> =>
      pipe(
        collection.updateOne({ id: GuildId.codec.encode(state.id) }, state, { upsert: true }),
        Future.map(r => r.modifiedCount + r.upsertedCount <= 1),
      ),
  }
}
