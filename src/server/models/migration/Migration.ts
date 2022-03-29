import { ord } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { DayJs } from '../../../shared/models/DayJs'
import type { Future } from '../../../shared/utils/fp'

export type Migration = {
  readonly createdAt: DayJs
  readonly migrate: Future<void>
}

const OrdCreatedAt: ord.Ord<Migration> = pipe(
  DayJs.Ord,
  ord.contramap(m => m.createdAt),
)

export const Migration = { OrdCreatedAt }