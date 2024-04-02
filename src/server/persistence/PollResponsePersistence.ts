import { pipe } from 'fp-ts/function'

import { DiscordUserId } from '../../shared/models/DiscordUserId'
import { MessageId } from '../../shared/models/MessageId'
import type { NotUsed } from '../../shared/utils/fp'
import { Future, List, NonEmptyArray } from '../../shared/utils/fp'

import { FpCollection } from '../helpers/FpCollection'
import type { LoggerGetter } from '../models/logger/LoggerObservable'
import type { MongoCollectionGetter } from '../models/mongo/MongoCollection'
import { PollResponse } from '../models/poll/PollResponse'

export type PollResponsePersistence = ReturnType<typeof PollResponsePersistence>

export const PollResponsePersistence = (
  Logger: LoggerGetter,
  mongoCollection: MongoCollectionGetter,
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
) => {
  const logger = Logger('PollResponsePersistence')
  const collection = FpCollection(logger)([PollResponse.codec, 'PollResponse'])(
    mongoCollection('pollResponse'),
  )

  const ensureIndexes: Future<NotUsed> = collection.ensureIndexes([
    { key: { message: -1, user: -1, choiceIndex: -1 }, unique: true },
  ])

  return {
    ensureIndexes,

    listForMessage: (message: MessageId): Future<List<PollResponse>> =>
      collection.findAllArr()({ message: MessageId.codec.encode(message) }),

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

    removeForMessages: (messages: List<MessageId>): Future<number> =>
      !List.isNonEmpty(messages)
        ? Future.successful(0)
        : pipe(
            collection.deleteMany({
              message: { $in: NonEmptyArray.encoder(MessageId.codec).encode(messages) },
            }),
            Future.map(r => r.deletedCount),
          ),
  }
}
