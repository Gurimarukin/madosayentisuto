import { pipe } from 'fp-ts/function'

import type { ChannelId } from '../../shared/models/ChannelId'
import { GuildId } from '../../shared/models/guild/GuildId'
import { Sink } from '../../shared/models/rx/Sink'
import { TObservable } from '../../shared/models/rx/TObservable'
import type { Dict, List, Maybe } from '../../shared/utils/fp'
import { Future } from '../../shared/utils/fp'

import { FpCollection } from '../helpers/FpCollection'
import type { GuildStateDbOutput } from '../models/guildState/db/GuildStateDb'
import {
  GuildStateDb,
  GuildStateDbOnlyItsFridayChannel,
} from '../models/guildState/db/GuildStateDb'
import type { LoggerGetter } from '../models/logger/LoggerObservable'
import type { MongoCollectionGetter } from '../models/mongo/MongoCollection'

type Projection = Partial<Dict<keyof GuildStateDbOutput, 1>>

export type GuildStatePersistence = ReturnType<typeof GuildStatePersistence>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const GuildStatePersistence = (
  Logger: LoggerGetter,
  mongoCollection: MongoCollectionGetter,
) => {
  const logger = Logger('GuildStatePersistence')
  const collection = FpCollection(logger)([GuildStateDb.codec, 'GuildStateDb'])(
    mongoCollection('guildState'),
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
