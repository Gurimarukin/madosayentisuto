import type { Future, NotUsed } from '../../utils/fp'

export type TObserver<A> = {
  readonly next: (value: A) => Future<NotUsed>
}
