import { Future } from '../utils/fp'

export type TObserver<A> = {
  readonly next: (value: A) => Future<void>
}
