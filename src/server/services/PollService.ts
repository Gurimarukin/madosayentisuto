import { apply } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { Future } from '../../shared/utils/fp'
import type { NonEmptyArray } from '../../shared/utils/fp'

import type { MessageId } from '../models/MessageId'
import type { PollQuestionPersistence } from '../persistence/PollQuestionPersistence'
import type { PollResponsePersistence } from '../persistence/PollResponsePersistence'

export type PollService = ReturnType<typeof PollService>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const PollService = (
  pollQuestionPersistence: PollQuestionPersistence,
  pollResponsePersistence: PollResponsePersistence,
) => ({
  createPoll: pollQuestionPersistence.insert,

  createResponse: pollResponsePersistence.insert,

  lookupByMessage: pollQuestionPersistence.lookupByMessage,

  removeResponse: pollResponsePersistence.remove,

  removeResponsesForUser: pollResponsePersistence.removeForUser,

  removePollForMessages: (messages: NonEmptyArray<MessageId>): Future<boolean> =>
    pipe(
      apply.sequenceT(Future.ApplyPar)(
        pollQuestionPersistence.removeForMessages(messages),
        pollResponsePersistence.removeForMessages(messages),
      ),
      Future.map(([removedQuestionsCount]) => removedQuestionsCount === messages.length),
    ),
})
