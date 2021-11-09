import type { Future } from 'shared/utils/fp'

export type TObserver<A> = {
  readonly next: (value: A) => Future<void>
}
