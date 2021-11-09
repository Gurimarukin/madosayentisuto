import { Subject } from 'rxjs'

import { IO } from 'shared/utils/fp'

import type { TObservable } from 'bot/models/rx/TObservable'
import type { TSubject } from 'bot/models/rx/TSubject'

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
