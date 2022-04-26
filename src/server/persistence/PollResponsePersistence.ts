import { pipe } from 'fp-ts/function'

import { DiscordUserId } from '../../shared/models/DiscordUserId'
import { Sink } from '../../shared/models/rx/Sink'
import type { NonEmptyArray } from '../../shared/utils/fp'
import { Future } from '../../shared/utils/fp'
import { List } from '../../shared/utils/fp'

import { FpCollection } from '../helpers/FpCollection'
import { MessageId } from '../models/MessageId'
import type { LoggerGetter } from '../models/logger/LoggerObservable'
import type { MongoCollection } from '../models/mongo/MongoCollection'
import type { PollResponseOutput } from '../models/poll/PollResponse'
import { PollResponse } from '../models/poll/PollResponse'

export type PollResponsePersistence = ReturnType<typeof PollResponsePersistence>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const PollResponsePersistence = (
  Logger: LoggerGetter,
  mongoCollection: (collName: string) => MongoCollection,
) => {
  const logger = Logger('PollResponsePersistence')
  const collection = FpCollection<PollResponse, PollResponseOutput>(
    logger,
    mongoCollection('pollResponse'),
    [PollResponse.codec, 'PollResponse'],
  )

  const ensureIndexes: Future<void> = collection.ensureIndexes([
    { key: { message: -1, user: -1, choiceIndex: -1 }, unique: true },
  ])

  return {
    ensureIndexes,

    listForMessage: (message: MessageId): Future<List<PollResponse>> =>
      pipe(collection.findAll()({ message: MessageId.codec.encode(message) }), Sink.readonlyArray),

    insert: (response: PollResponse): Future<boolean> =>
      pipe(
        collection.insertOne(response),
        Future.map(r => r.acknowledged),
      ),

    remove: ({ message, user, choiceIndex }: PollResponse): Future<boolean> =>
      pipe(
        collection.deleteOne({
          message: MessageId.codec.encode(message),
          user: DiscordUserId.codec.encode(user),
          choiceIndex,
        }),
        Future.map(r => r.deletedCount === 1),
      ),

    removeForUser: (message: MessageId, user: DiscordUserId): Future<number> =>
      pipe(
        collection.deleteMany({
          message: MessageId.codec.encode(message),
          user: DiscordUserId.codec.encode(user),
        }),
        Future.map(r => r.deletedCount),
      ),

    removeForMessages: (messages: NonEmptyArray<MessageId>): Future<number> =>
      pipe(
        collection.deleteMany({
          message: { $in: List.encoder(MessageId.codec).encode(messages) },
        }),
        Future.map(r => r.deletedCount),
      ),
  }
}
