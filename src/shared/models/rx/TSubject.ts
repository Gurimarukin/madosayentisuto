import type { IO } from '../../utils/fp'
import type { NotUsed } from '../NotUsed'

export type TSubject<A> = {
  readonly next: (value: A) => IO<NotUsed>
  readonly complete: IO<void>
}
