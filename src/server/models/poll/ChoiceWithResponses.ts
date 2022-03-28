import { pipe } from 'fp-ts/function'
import { lens } from 'monocle-ts'

import type { UserId } from '../../../shared/models/guild/UserId'
import type { List } from '../../../shared/utils/fp'

export type ChoiceWithResponses = {
  readonly choice: string
  readonly responses: List<UserId>
}

const empty = (choice: string): ChoiceWithResponses => ({ choice, responses: [] })

const Lens = {
  responses: pipe(lens.id<ChoiceWithResponses>(), lens.prop('responses')),
}

export const ChoiceWithResponses = { empty, Lens }
