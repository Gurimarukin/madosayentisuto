import { pipe } from 'fp-ts/function'

import { GuildId } from '../../shared/models/guild/GuildId'
import { UserId } from '../../shared/models/guild/UserId'
import { Future } from '../../shared/utils/fp'
import type { List, Maybe } from '../../shared/utils/fp'
import { NonEmptyArray } from '../../shared/utils/fp'

import { FpCollection } from '../helpers/FpCollection'
import { TSnowflake } from '../models/TSnowflake'
import type { LoggerGetter } from '../models/logger/LoggerType'
import type { MongoCollection } from '../models/mongo/MongoCollection'
import type { PollResponseOutput } from '../models/poll/PollResponse'
import { PollResponse } from '../models/poll/PollResponse'

type FindAll = {
  readonly guild: GuildId
  readonly message: TSnowflake
}

type Find = FindAll & {
  readonly user: UserId
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
        user: UserId.unwrap(user),
      }),

    listForMessage: ({ guild, message }: FindAll): Future<List<PollResponse>> =>
      collection.findAll()({
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
            user: UserId.unwrap(user),
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

    deleteByMessageIds: (guildId: GuildId, messages: NonEmptyArray<TSnowflake>): Future<number> =>
      pipe(
        collection.deleteMany({
          guild: GuildId.unwrap(guildId),
          message: { $in: pipe(messages, NonEmptyArray.map(TSnowflake.unwrap)) },
        }),
        Future.map(r => r.deletedCount),
      ),
  }
}
