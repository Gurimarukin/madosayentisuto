import { observable } from 'fp-ts-rxjs'
import { flow, pipe } from 'fp-ts/function'
import type { Subscription } from 'rxjs'

import type { List } from '../../shared/utils/fp'
import { Future } from '../../shared/utils/fp'
import { IO } from '../../shared/utils/fp'

import type { LoggerType } from '../models/logger/LoggerType'
import type { ObserverWithRefinement } from '../models/rx/ObserverWithRefinement'
import { TObservable } from '../models/rx/TObservable'

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
  <A>(logger: LoggerType, obs: TObservable<A>) =>
  <B extends A>({ observer, refinement }: ObserverWithRefinement<A, B>): IO<Subscription> =>
    pipe(
      obs,
      observable.filter(refinement),
      TObservable.subscribe({
        next: flow(
          observer.next,
          Future.orElseIOEitherK(e => logger.error(e.stack)),
        ),
      }),
    )

export const PubSubUtils = { publishOn, subscribe }
