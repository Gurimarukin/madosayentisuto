import { Observable, PartialObserver, Subscription } from 'rxjs'

import { Future, IO } from '../utils/fp'
import { TObserver } from './TObserver'

export type TObservable<A> = Observable<A>

export const TObservable = {
  subscribe:
    <A>({ next }: TObserver<A>) =>
    (fa: TObservable<A>): IO<Subscription> => {
      const subscriber: PartialObserver<A> = { next: a => Future.runUnsafe(next(a)) }
      return IO.tryCatch(() => fa.subscribe(subscriber))
    },
}
