import type { IO, NotUsed } from '../../utils/fp'

export type TSubject<A> = {
  next: (value: A) => IO<NotUsed>
  complete: IO<NotUsed>
}
