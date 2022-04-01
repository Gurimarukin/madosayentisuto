import { pipe } from 'fp-ts/function'

import type { Maybe } from '../../shared/utils/fp'
import { NonEmptyArray } from '../../shared/utils/fp'
import { Future } from '../../shared/utils/fp'

import { FpCollection } from '../helpers/FpCollection'
import { MessageId } from '../models/MessageId'
import type { LoggerGetter } from '../models/logger/LoggerGetter'
import type { MongoCollection } from '../models/mongo/MongoCollection'
import type { PollQuestionOutput } from '../models/poll/PollQuestion'
import { PollQuestion } from '../models/poll/PollQuestion'

export type PollQuestionPersistence = ReturnType<typeof PollQuestionPersistence>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const PollQuestionPersistence = (Logger: LoggerGetter, mongoCollection: MongoCollection) => {
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
      collection.findOne({ message: MessageId.unwrap(message) }),

    insert: (question: PollQuestion): Future<boolean> =>
      pipe(
        collection.insertOne(question),
        Future.map(r => r.acknowledged),
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
