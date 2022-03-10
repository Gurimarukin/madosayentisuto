import { pipe } from 'fp-ts/function'

import { GuildId } from '../../shared/models/guild/GuildId'
import { Future } from '../../shared/utils/fp'
import type { List, Maybe } from '../../shared/utils/fp'

import { FpCollection } from '../helpers/FpCollection'
import type { MongoCollection } from '../models/MongoCollection'
import type { PollResponseOutput } from '../models/PollResponse'
import { PollResponse } from '../models/PollResponse'
import { TSnowflake } from '../models/TSnowflake'
import type { LoggerGetter } from '../models/logger/LoggerType'

type FindAll = {
  readonly guild: GuildId
  readonly message: TSnowflake
}

type Find = FindAll & {
  readonly user: TSnowflake
}

export type PollResponsePersistence = ReturnType<typeof PollResponsePersistence>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const PollResponsePersistence = (Logger: LoggerGetter, mongoCollection: MongoCollection) => {
  const logger = Logger('PollResponsePersistence')
  const collection = FpCollection<PollResponse, PollResponseOutput>(
    logger,
    mongoCollection('pollResponse'),
    [PollResponse.codec, 'PollResponse'],
  )

  const ensureIndexes: Future<void> = collection.ensureIndexes([
    { key: { guild: -1, message: -1, user: -1 }, unique: true },
  ])

  return {
    ensureIndexes,

    lookupByUser: ({ guild, message, user }: Find): Future<Maybe<PollResponse>> =>
      collection.findOne({
        guild: GuildId.unwrap(guild),
        message: TSnowflake.unwrap(message),
        user: TSnowflake.unwrap(user),
      }),

    listForMessage: ({ guild, message }: FindAll): Future<List<PollResponse>> =>
      collection.findAll([PollResponse.codec, 'PollResponse'])({
        guild: GuildId.unwrap(guild),
        message: TSnowflake.unwrap(message),
      }),

    upsert: (response: PollResponse): Future<boolean> => {
      const { guild, message, user } = response
      return pipe(
        collection.updateOne(
          {
            guild: GuildId.unwrap(guild),
            message: TSnowflake.unwrap(message),
            user: TSnowflake.unwrap(user),
          },
          response,
          { upsert: true },
        ),
        Future.map(r => {
          const affectedCount = r.modifiedCount + r.upsertedCount
          return affectedCount === 0 || affectedCount === 1
        }),
      )
    },
  }
}
