import { pipe } from 'fp-ts/function'
import { lens } from 'monocle-ts'

import type { UserId } from '../../../shared/models/guild/UserId'
import { List, Maybe, NonEmptyArray } from '../../../shared/utils/fp'

import type { MessageId } from '../MessageId'
import type { ChoiceWithResponses } from './ChoiceWithResponses'
import type { PollQuestion } from './PollQuestion'
import type { PollResponse } from './PollResponse'

export type Poll = {
  readonly message: MessageId
  readonly createdBy: UserId
  readonly question: string
  readonly choices: NonEmptyArray<ChoiceWithResponses>
}

const fromQuestionAndResponses = (
  { message, createdBy, question, choices }: PollQuestion,
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
})

const Lens = {
  choices: pipe(lens.id<Poll>(), lens.prop('choices')),
}

export const Poll = { fromQuestionAndResponses, Lens }