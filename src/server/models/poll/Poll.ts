import { pipe } from 'fp-ts/function'
import { lens } from 'monocle-ts'

import type { DiscordUserId } from '../../../shared/models/DiscordUserId'
import type { MessageId } from '../../../shared/models/MessageId'
import { List, Maybe, NonEmptyArray } from '../../../shared/utils/fp'

import type { ChoiceWithResponses } from './ChoiceWithResponses'
import type { PollQuestion } from './PollQuestion'
import type { PollResponse } from './PollResponse'
import type { ThreadWithMessage } from './ThreadWithMessage'

export type Poll = {
  message: MessageId
  createdBy: DiscordUserId
  question: string
  choices: NonEmptyArray<ChoiceWithResponses>
  detail: Maybe<ThreadWithMessage>
  isAnonymous: boolean
  isMultiple: boolean
}

const fromQuestionAndResponses = (
  { message, createdBy, question, choices, detail, isAnonymous, isMultiple }: PollQuestion,
  responses: List<PollResponse>,
): Poll => ({
  message,
  createdBy,
  question,
  choices: pipe(
    choices,
    NonEmptyArray.mapWithIndex(
      (index, choice): ChoiceWithResponses => ({
        choice,
        responses: pipe(
          responses,
          List.filterMap(r => (r.choiceIndex === index ? Maybe.some(r.user) : Maybe.none)),
        ),
      }),
    ),
  ),
  detail,
  isAnonymous,
  isMultiple,
})

const Lens = {
  choices: pipe(lens.id<Poll>(), lens.prop('choices')),
}

export const Poll = { fromQuestionAndResponses, Lens }
