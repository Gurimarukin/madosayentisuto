import type { ChoiceWithResponses } from './ChoiceWithResponses'

export type ChoiceWithVotesCount = {
  choice: string
  votesCount: number
}

const empty = (choice: string): ChoiceWithVotesCount => ({ choice, votesCount: 0 })

const fromChoiceWithResponses = ({
  choice,
  responses,
}: ChoiceWithResponses): ChoiceWithVotesCount => ({ choice, votesCount: responses.length })

export const ChoiceWithVotesCount = { empty, fromChoiceWithResponses }
