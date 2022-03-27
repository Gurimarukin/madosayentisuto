import { pipe } from 'fp-ts/function'

import { UserId } from '../../shared/models/guild/UserId'
import { Future, NonEmptyArray } from '../../shared/utils/fp'
import type { List } from '../../shared/utils/fp'

import { FpCollection } from '../helpers/FpCollection'
import { MessageId } from '../models/MessageId'
import type { LoggerGetter } from '../models/logger/LoggerType'
import type { MongoCollection } from '../models/mongo/MongoCollection'
import type { PollResponseOutput } from '../models/poll/PollResponse'
import { PollResponse } from '../models/poll/PollResponse'

export type PollResponsePersistence = ReturnType<typeof PollResponsePersistence>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const PollResponsePersistence = (Logger: LoggerGetter, mongoCollection: MongoCollection) => {
  const logger = Logger('PollResponsePersistence')
  const collection = FpCollection<PollResponse, PollResponseOutput>(
    logger,
    mongoCollection(PollResponsePersistenceHelpers.table),
    [PollResponse.codec, 'PollResponse'],
  )

  const ensureIndexes: Future<void> = collection.ensureIndexes([
    { key: { message: -1, user: -1, choiceIndex: -1 }, unique: true },
  ])

  return {
    ensureIndexes,

    listForUser: (message: MessageId, user: UserId): Future<List<PollResponse>> =>
      collection.findAll()({
        message: MessageId.unwrap(message),
        user: UserId.unwrap(user),
      }),

    insert: (response: PollResponse): Future<boolean> =>
      pipe(
        collection.insertOne(response),
        Future.map(r => r.acknowledged),
      ),

    remove: ({ message, user, choiceIndex }: PollResponse): Future<boolean> =>
      pipe(
        collection.deleteOne({
          message: MessageId.unwrap(message),
          user: UserId.unwrap(user),
          choiceIndex,
        }),
        Future.map(r => r.deletedCount === 1),
      ),

    removeForUser: (message: MessageId, user: UserId): Future<number> =>
      pipe(
        collection.deleteMany({
          message: MessageId.unwrap(message),
          user: UserId.unwrap(user),
        }),
        Future.map(r => r.deletedCount),
      ),

    removeForMessages: (messages: NonEmptyArray<MessageId>): Future<number> =>
      pipe(
        collection.deleteMany({
          message: { $in: pipe(messages, NonEmptyArray.map(MessageId.unwrap)) },
        }),
        Future.map(r => r.deletedCount),
      ),
  }
}

export const PollResponsePersistenceHelpers = {
  table: 'pollResponse',
}
