import { pipe } from 'fp-ts/function'
import { Subject } from 'rxjs'

import { IO, toNotUsed } from '../../utils/fp'
import type { TObservable } from './TObservable'
import type { TSubject } from './TSubject'

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

  return {
    subject: {
      next: a =>
        pipe(
          IO.tryCatch(() => subject.next(a)),
          IO.map(toNotUsed),
        ),
      complete: IO.tryCatch(() => subject.complete()),
    },
    observable: subject.asObservable(),
  }
}
