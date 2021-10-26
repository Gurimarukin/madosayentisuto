import { io } from 'fp-ts'
import { pipe } from 'fp-ts/function'
import { PartialObserver, Subject, Subscription } from 'rxjs'

import { Subscriber } from '../models/Subscriber'
import { Either, IO } from '../utils/fp'
import { PartialLogger } from './Logger'

type StrongSubject<A> = Omit<Subject<A>, 'next'> & {
  // eslint-disable-next-line functional/no-return-void
  readonly next: (value: A) => void
}

export type PubSub<A> = {
  readonly publish: (a: A) => IO<void>
  readonly subscribe: (subscriber: Subscriber<A>) => IO<Subscription>
}

export const PubSub = <A>(Logger: PartialLogger): IO<PubSub<A>> => {
  const logger = Logger('PubSub')

  const subject: StrongSubject<A> = new Subject()

  const publish: PubSub<A>['publish'] = a => IO.tryCatch(() => subject.next(a))

  const subscribe: PubSub<A>['subscribe'] = ({ next, error, complete }) => {
    const subscriber: PartialObserver<A> = {
      ...(next !== undefined ? { next: a => runUnsafe(next(a)) } : {}),
      ...(error !== undefined ? { error: (u: unknown) => runUnsafe(error(u)) } : {}),
      ...(complete !== undefined ? { complete: () => runUnsafe(complete()) } : {}),
    } as PartialObserver<A>
    return IO.tryCatch(() => subject.subscribe(subscriber))
  }

  return pipe(
    subscribe({ next: a => logger.debug('✉️ ', a) }),
    IO.map((): PubSub<A> => ({ publish, subscribe })),
  )

  // eslint-disable-next-line functional/no-return-void
  function runUnsafe(fa: IO<void>): void {
    return pipe(
      fa,
      io.chain(
        Either.fold(
          e => logger.error(e.stack),
          a => IO.of(a),
        ),
      ),
      IO.runUnsafe,
    )
  }
}
