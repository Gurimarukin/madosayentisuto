import { Observable, PartialObserver, Subscription } from 'rxjs'

import { Future, IO } from '../utils/fp'
import { TObserver } from './TObserver'

export type TObservable<A> = Observable<A>

export const TObservable = {
  subscribe:
    <A>({ next, error, complete }: TObserver<A>) =>
    (fa: TObservable<A>): IO<Subscription> => {
      const subscriber: PartialObserver<A> = {
        ...(next !== undefined ? { next: a => Future.runUnsafe(next(a)) } : {}),
        ...(error !== undefined ? { error: (u: unknown) => Future.runUnsafe(error(u)) } : {}),
        ...(complete !== undefined ? { complete: () => Future.runUnsafe(complete()) } : {}),
      } as PartialObserver<A>
      return IO.tryCatch(() => fa.subscribe(subscriber))
    },
}
