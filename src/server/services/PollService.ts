import { pipe } from 'fp-ts/function'

import { Future } from '../../shared/utils/fp'
import type { Maybe, NonEmptyArray } from '../../shared/utils/fp'
import { futureMaybe } from '../../shared/utils/futureMaybe'

import type { MessageId } from '../models/MessageId'
import { Poll } from '../models/poll/Poll'
import type { PollQuestionPersistence } from '../persistence/PollQuestionPersistence'
import type { PollResponsePersistence } from '../persistence/PollResponsePersistence'

type RemoveResult = {
  readonly removedQuestions: number
  readonly removedResponses: number
}

export type PollService = ReturnType<typeof PollService>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const PollService = (
  pollQuestionPersistence: PollQuestionPersistence,
  pollResponsePersistence: PollResponsePersistence,
) => ({
  createPoll: pollQuestionPersistence.insert,

  createResponse: pollResponsePersistence.insert,

  lookupByMessage: (messageId: MessageId): Future<Maybe<Poll>> =>
    pipe(
      pollQuestionPersistence.lookupByMessage(messageId),
      futureMaybe.chainFuture(question =>
        pipe(
          pollResponsePersistence.listForMessage(messageId),
          Future.map(responses => Poll.fromQuestionAndResponses(question, responses)),
        ),
      ),
    ),

  removeResponse: pollResponsePersistence.remove,

  removeResponsesForUser: pollResponsePersistence.removeForUser,

  removePollForMessages: (messages: NonEmptyArray<MessageId>): Future<RemoveResult> =>
    pipe(
      pollQuestionPersistence.removeForMessages(messages),
      Future.chain(removedQuestions =>
        removedQuestions === 0
          ? Future.right<RemoveResult>({ removedQuestions, removedResponses: 0 })
          : pipe(
              pollResponsePersistence.removeForMessages(messages),
              Future.map(
                (removedResponses): RemoveResult => ({ removedQuestions, removedResponses }),
              ),
            ),
      ),
    ),
})
