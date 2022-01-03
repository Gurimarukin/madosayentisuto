import type { IO } from '../../../shared/utils/fp'

export type TSubject<A> = {
  readonly next: (value: A) => IO<void>
}
