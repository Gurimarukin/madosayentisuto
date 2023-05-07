import type { Future, NotUsed } from '../../utils/fp'

export type TObserver<A> = {
  next: (value: A) => Future<NotUsed>
}
