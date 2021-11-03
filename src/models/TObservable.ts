import { Observable, PartialObserver } from 'rxjs'

import { IO } from '../utils/fp'
import { TObserver } from './TObserver'

export type TObservable<A> = Observable<A>

export const TObservable = {
  subscribe:
    <A>({ next, error, complete }: TObserver<A>) =>
    (fa: TObservable<A>) => {
      const subscriber: PartialObserver<A> = {
        ...(next !== undefined ? { next: a => IO.runUnsafe(next(a)) } : {}),
        ...(error !== undefined ? { error: (u: unknown) => IO.runUnsafe(error(u)) } : {}),
        ...(complete !== undefined ? { complete: () => IO.runUnsafe(complete()) } : {}),
      } as PartialObserver<A>
      return IO.tryCatch(() => fa.subscribe(subscriber))
    },
}
