import type { IO, NotUsed } from '../../utils/fp'

export type TSubject<A> = {
  readonly next: (value: A) => IO<NotUsed>
  readonly complete: IO<NotUsed>
}
