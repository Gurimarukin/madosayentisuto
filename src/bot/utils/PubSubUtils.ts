import { refinement } from 'fp-ts'
import { observable } from 'fp-ts-rxjs'
import type { Refinement } from 'fp-ts/Refinement'
import { flow, pipe } from 'fp-ts/function'
import type { Subscription } from 'rxjs'

import { Future, List, NonEmptyArray } from '../../shared/utils/fp'
import { IO } from '../../shared/utils/fp'

import type { LoggerType } from '../models/logger/LoggerType'
import { TObservable } from '../models/rx/TObservable'
import type { TObserver } from '../models/rx/TObserver'

type TinyListenerSignature<L> = {
  readonly // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [E in keyof L]: (...args: List<any>) => any
}

type ListenerSignature<L> = {
  readonly [E in keyof L]: readonly [...args: List<unknown>]
}

export type ToTiny<L extends ListenerSignature<L>> = {
  readonly // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [K in keyof L]: (...args: L[K]) => any
}

type EventListenable<L extends TinyListenerSignature<L>> = {
  // eslint-disable-next-line functional/no-return-void
  readonly on: <K extends keyof L>(event: K, listener: L[K]) => void
}

const publishOn =
  <L extends TinyListenerSignature<L>, A>(
    listenable: EventListenable<L>,
    publish: (a: A) => IO<void>,
  ) =>
  <K extends keyof L>(event: K, transformer: (...args: Parameters<L[K]>) => A): IO<void> =>
    IO.tryCatch(() =>
      listenable.on(event, ((...args: Parameters<L[K]>) =>
        pipe(publish(transformer(...args)), IO.runUnsafe)) as L[K]),
    )

const subscribe =
  <A>(logger: LoggerType, observable_: TObservable<A>) =>
  <B extends A>(
    { next }: TObserver<B>,
    // we invert it, so we are sure our Refinement is exhaustive
    refinement_: Refinement<A, Exclude<A, B>>,
  ): IO<Subscription> =>
    pipe(
      observable_,
      observable.filter(refinement.not(refinement_) as unknown as Refinement<A, B>),
      TObservable.subscribe({
        next: flow(
          next,
          Future.orElse(e => Future.fromIOEither(logger.error(e.stack))),
        ),
      }),
    )

/**
 * Syntatic sugar.
 * It isn't really a `or` operator, as it returns `not(b) [and not(c) [and not(d) ...]]`,
 * but `subscribe` (above) does a final `not`, so it ends up being a `or`.
 * And it makes `subscribe` typesafe.
 */
function or<A, B extends A>(b: Refinement<A, B>): Refinement<A, Exclude<A, B>>
function or<A, B extends A, C extends A>(
  b: Refinement<A, B>,
  c: Refinement<A, C>,
): Refinement<A, Exclude<A, B> & Exclude<A, C>>
function or<A, B extends A, C extends A, D extends A>(
  b: Refinement<A, B>,
  c: Refinement<A, C>,
  d: Refinement<A, D>,
): Refinement<A, Exclude<A, B> & Exclude<A, C> & Exclude<A, D>>
function or<A, R extends NonEmptyArray<Refinement<A, A>>>(...refinements_: R): Refinement<A, A> {
  return pipe(refinements_, NonEmptyArray.unprepend, ([head, tail]) =>
    pipe(
      tail,
      List.reduce(refinement.not(head), (acc, r) => pipe(acc, refinement.and(refinement.not(r)))),
    ),
  )
}

export const PubSubUtils = { publishOn, subscribe, or }
