import type { io } from 'fp-ts'
import { pipe } from 'fp-ts/function'
import type * as rxjs from 'rxjs'

import type { LoggerType } from '../models/LoggerType'
import type { ObserverWithRefinement } from '../models/rx/ObserverWithRefinement'
import { TObservable } from '../models/rx/TObservable'
import { LogUtils } from './LogUtils'
import type { Dict, List, NotUsed } from './fp'
import { IO, toNotUsed } from './fp'

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

type EventListenable<On extends string, L extends TinyListenerSignature<L>> = Dict<
  On,
  // eslint-disable-next-line functional/no-return-void
  <K extends keyof L>(event: K, listener: L[K]) => void
>

const publish_ =
  (onError: (e: Error) => io.IO<NotUsed>) =>
  <A>(publish: (a: A) => IO<NotUsed>) =>
  <On extends string>(on: On) =>
  <L extends TinyListenerSignature<L>>(listenable: EventListenable<On, L>) =>
  <K extends keyof L>(event: K, transformer: (...args: Parameters<L[K]>) => A): IO<NotUsed> =>
    pipe(
      IO.tryCatch(() =>
        listenable[on](event, ((...args: Parameters<L[K]>) =>
          pipe(publish(transformer(...args)), IO.run(onError))) as L[K]),
      ),
      IO.map(toNotUsed),
    )

const subscribeWithRefinement =
  <A>(logger: LoggerType, observable: TObservable<A>) =>
  <B extends A>({ observer, refinement }: ObserverWithRefinement<A, B>): IO<rxjs.Subscription> =>
    TObservable.subscribe(LogUtils.onError(logger))(observer)(
      pipe(observable, TObservable.filter(refinement)),
    )

export const PubSubUtils = { publish: publish_, subscribeWithRefinement }
