import { pipe } from 'fp-ts/function'

import type { MessageId } from '../../shared/models/MessageId'
import type { List, Maybe } from '../../shared/utils/fp'
import { Future } from '../../shared/utils/fp'
import { futureMaybe } from '../../shared/utils/futureMaybe'

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

  lookupQuestionByMessage: pollQuestionPersistence.lookupByMessage,

  lookupPollByMessage: (messageId: MessageId): Future<Maybe<Poll>> =>
    pipe(
      pollQuestionPersistence.lookupByMessage(messageId),
      futureMaybe.chainTaskEitherK(question =>
        pipe(
          pollResponsePersistence.listForMessage(messageId),
          Future.map(responses => Poll.fromQuestionAndResponses(question, responses)),
        ),
      ),
    ),

  setPollDetail: pollQuestionPersistence.setDetail,

  removeResponse: pollResponsePersistence.remove,

  removeResponsesForUser: pollResponsePersistence.removeForUser,

  removePollForMessages: (messages: List<MessageId>): Future<RemoveResult> =>
    pipe(
      pollQuestionPersistence.removeForMessages(messages),
      Future.chain(removedQuestions =>
        removedQuestions === 0
          ? Future.successful<RemoveResult>({ removedQuestions, removedResponses: 0 })
          : pipe(
              pollResponsePersistence.removeForMessages(messages),
              Future.map(
                (removedResponses): RemoveResult => ({ removedQuestions, removedResponses }),
              ),
            ),
      ),
    ),
})
