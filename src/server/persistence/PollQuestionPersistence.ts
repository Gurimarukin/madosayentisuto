import { pipe } from 'fp-ts/function'

import { List, Maybe } from '../../shared/utils/fp'
import type { NonEmptyArray } from '../../shared/utils/fp'
import { Future } from '../../shared/utils/fp'

import { FpCollection } from '../helpers/FpCollection'
import { MessageId } from '../models/MessageId'
import type { LoggerGetter } from '../models/logger/LoggerGetter'
import type { MongoCollection } from '../models/mongo/MongoCollection'
import type { PollQuestionOutput } from '../models/poll/PollQuestion'
import { PollQuestion } from '../models/poll/PollQuestion'
import { ThreadWithMessage } from '../models/poll/ThreadWithMessage'

export type PollQuestionPersistence = ReturnType<typeof PollQuestionPersistence>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const PollQuestionPersistence = (
  Logger: LoggerGetter,
  mongoCollection: (collName: string) => MongoCollection,
) => {
  const logger = Logger('PollQuestionPersistence')
  const collection = FpCollection<PollQuestion, PollQuestionOutput>(
    logger,
    mongoCollection('pollQuestion'),
    [PollQuestion.codec, 'PollQuestion'],
  )

  const ensureIndexes: Future<void> = collection.ensureIndexes([
    { key: { message: -1 }, unique: true },
  ])

  return {
    ensureIndexes,

    lookupByMessage: (message: MessageId): Future<Maybe<PollQuestion>> =>
      collection.findOne({ message: MessageId.codec.encode(message) }),

    insert: (question: PollQuestion): Future<boolean> =>
      pipe(
        collection.insertOne(question),
        Future.map(r => r.acknowledged),
      ),

    setDetail: (message: MessageId, detail: ThreadWithMessage): Future<boolean> => {
      const encodedDetail = Maybe.encoder(ThreadWithMessage.codec).encode(Maybe.some(detail))
      return pipe(
        collection.collection.future(coll =>
          coll.updateOne(
            { message: MessageId.codec.encode(message) },
            { $set: { detail: encodedDetail } },
          ),
        ),
        Future.map(r => r.modifiedCount + r.upsertedCount <= 1),
      )
    },

    removeForMessages: (messages: NonEmptyArray<MessageId>): Future<number> =>
      pipe(
        collection.deleteMany({
          message: { $in: List.encoder(MessageId.codec).encode(messages) },
        }),
        Future.map(r => r.deletedCount),
      ),
  }
}
