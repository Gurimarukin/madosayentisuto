import { io } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'

import { Future, IO, List, Maybe, NonEmptyArray, NotUsed } from '../../utils/fp'
import { Store } from '../Store'
import { PubSub } from './PubSub'
import type { TObservable } from './TObservable'

const maxQueueSize = 100

type AsyncQueue<A> = {
  readonly observable: TObservable<A>
  readonly queue: (f: Future<A>) => IO<NotUsed>
}

/**
 * @param onError For eventual Errors when running Futures in queue.
 */
const AsyncQueue = <A>(onError: (e: Error) => io.IO<NotUsed>): AsyncQueue<A> => {
  // Holds Future to publish when completed.
  // First element is removed only when completed.
  // So the first element (if exists) is the currently running Future.
  const pendingFutures = Store<List<Future<A>>>(List.empty)
  const pubSub = PubSub<A>()

  return {
    observable: pubSub.observable,
    queue: f =>
      pipe(
        pendingFutures.get,
        IO.fromIO,
        IO.filterOrElse(
          q => q.length <= maxQueueSize,
          () => Error('Max size reached for AsyncQueue'),
        ),
        IO.chainIOK(flow(List.append(f), pendingFutures.set)),
        IO.chainIOK(q =>
          q.length === 1 ? pipe(runQueue(), IO.runFuture(onError)) : io.of(NotUsed),
        ),
      ),
  }

  function runQueue(): Future<NotUsed> {
    return pipe(
      pendingFutures.get,
      Future.fromIO,
      Future.chain(
        List.match(
          () => Future.notUsed,
          flow(
            NonEmptyArray.head,
            Future.chainIOEitherK(pubSub.subject.next),
            Future.chainIOK(() =>
              pendingFutures.modify(
                flow(
                  List.tail,
                  Maybe.getOrElseW(() => List.empty),
                ),
              ),
            ),
            Future.chain(q => (List.isNonEmpty(q) ? runQueue() : Future.notUsed)),
          ),
        ),
      ),
    )
  }
}

export { AsyncQueue }
