import type { IO } from '../../utils/fp'

export type TSubject<A> = {
  readonly next: (value: A) => IO<void>
  readonly complete: IO<void>
}
