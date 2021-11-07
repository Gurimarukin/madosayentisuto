import { Subject } from 'rxjs'

import { TObservable } from '../models/TObservable'
import { TSubject } from '../models/TSubject'
import { IO } from '../utils/fp'

type StrongSubject<A> = Omit<Subject<A>, 'next'> & {
  // eslint-disable-next-line functional/no-return-void
  readonly next: (value: A) => void
}

export type PubSub<A> = {
  readonly subject: TSubject<A>
  readonly observable: TObservable<A>
}

export const PubSub = <A>(): PubSub<A> => {
  const subject: StrongSubject<A> = new Subject()

  const next: TSubject<A>['next'] = a => IO.tryCatch(() => subject.next(a))
  const observable: PubSub<A>['observable'] = subject.asObservable()

  return { subject: { next }, observable }
}
