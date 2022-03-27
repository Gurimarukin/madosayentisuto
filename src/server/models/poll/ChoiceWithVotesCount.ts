import type { ChoiceWithResponses } from './ChoiceWithResponses'

export type ChoiceWithVotesCount = {
  readonly choice: string
  readonly votesCount: number
}

const empty = (choice: string): ChoiceWithVotesCount => ({ choice, votesCount: 0 })

const fromChoiceWithResponses = ({
  choice,
  responses,
}: ChoiceWithResponses): ChoiceWithVotesCount => ({ choice, votesCount: responses.length })

export const ChoiceWithVotesCount = { empty, fromChoiceWithResponses }
