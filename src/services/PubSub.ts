import { pipe } from 'fp-ts/function'
import { Subject } from 'rxjs'

import { TObservable } from '../models/TObservable'
import { TSubject } from '../models/TSubject'
import { Future, IO, Maybe, NonEmptyArray } from '../utils/fp'
import { PartialLogger } from './Logger'

type StrongSubject<A> = Omit<Subject<A>, 'next'> & {
  // eslint-disable-next-line functional/no-return-void
  readonly next: (value: A) => void
}

export type PubSub<A> = {
  readonly subject: TSubject<A>
  readonly observable: TObservable<A>
}

export const PubSub = <A>(
  Logger: PartialLogger,
  debugMessage: Maybe<(a: A) => NonEmptyArray<unknown>> = Maybe.none,
): IO<PubSub<A>> => {
  const logger = Logger('PubSub')

  const subject: StrongSubject<A> = new Subject()

  const next: TSubject<A>['next'] = a => IO.tryCatch(() => subject.next(a))
  const observable: PubSub<A>['observable'] = subject.asObservable()

  return pipe(
    debugMessage,
    Maybe.fold(
      () => IO.unit,
      log =>
        pipe(
          observable,
          TObservable.subscribe({ next: a => Future.fromIOEither(logger.debug('✉️ ', ...log(a))) }),
          IO.map(() => {}),
        ),
    ),
    IO.map((): PubSub<A> => ({ subject: { next }, observable })),
  )
}
