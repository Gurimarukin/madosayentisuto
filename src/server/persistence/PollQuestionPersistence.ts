import { pipe } from 'fp-ts/function'

import type { Maybe } from '../../shared/utils/fp'
import { Either } from '../../shared/utils/fp'
import { NonEmptyArray } from '../../shared/utils/fp'
import { Future } from '../../shared/utils/fp'
import { futureMaybe } from '../../shared/utils/futureMaybe'
import { decodeError } from '../../shared/utils/ioTsUtils'

import { FpCollection, FpCollectionHelpers } from '../helpers/FpCollection'
import { MessageId } from '../models/MessageId'
import type { LoggerGetter } from '../models/logger/LoggerType'
import type { MongoCollection } from '../models/mongo/MongoCollection'
import { Poll } from '../models/poll/Poll'
import type { PollQuestionOutput } from '../models/poll/PollQuestion'
import { PollQuestion } from '../models/poll/PollQuestion'
import type { PollResponseOutput } from '../models/poll/PollResponse'
import { PollResponsePersistenceHelpers } from './PollResponsePersistence'

const Keys = {
  pollResponse: {
    message: FpCollectionHelpers.getPath<PollResponseOutput>()(['message']),
    user: FpCollectionHelpers.getPath<PollResponseOutput>()(['user']),
    choiceIndex: FpCollectionHelpers.getPath<PollResponseOutput>()(['choiceIndex']),
  },
  responses: 'responses',
}

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

    lookupByMessage: (message: MessageId): Future<Maybe<Poll>> =>
      pipe(
        collection.collection(coll =>
          coll
            .aggregate([], { allowDiskUse: true })
            .match({ message: MessageId.unwrap(message) })
            .lookup({
              from: PollResponsePersistenceHelpers.table,
              localField: collection.path(['message']),
              foreignField: Keys.pollResponse.message,
              as: Keys.responses,
            })
            .unwind(`$${Keys.responses}`)
            .group({
              _id: `$${Keys.responses}.${Keys.pollResponse.choiceIndex}`,
              message: { $first: `$${collection.path(['message'])}` },
              createdBy: { $first: `$${collection.path(['createdBy'])}` },
              question: { $first: `$${collection.path(['question'])}` },
              choices: { $first: `$${collection.path(['choices'])}` },
              responses: { $push: `$${Keys.responses}.${Keys.pollResponse.user}` },
            })
            .toArray(),
        ),
        Future.map(NonEmptyArray.fromReadonlyArray),
        futureMaybe.chainFuture(u =>
          pipe(Poll.decoder.decode(u), Either.mapLeft(decodeError('Poll')(u)), Future.fromEither),
        ),
      ),

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
