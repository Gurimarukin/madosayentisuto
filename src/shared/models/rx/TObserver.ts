import type { Future } from '../../utils/fp'
import type { NotUsed } from '../NotUsed'

export type TObserver<A> = {
  readonly next: (value: A) => Future<NotUsed>
}
