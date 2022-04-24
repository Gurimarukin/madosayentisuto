import { observable } from 'fp-ts-rxjs'
import type { Predicate } from 'fp-ts/Predicate'
import type { Refinement } from 'fp-ts/Refinement'
import { flow } from 'fp-ts/function'
import * as rxjs from 'rxjs'
import * as rxjsStream from 'rxjs-stream'
import * as rxjsOperators from 'rxjs/operators'
import type { Readable } from 'stream'

import type { List, Maybe, NonEmptyArray } from '../../../shared/utils/fp'
import { Future, IO, Try } from '../../../shared/utils/fp'

import type { TObserver } from './TObserver'

/* eslint-disable functional/no-return-void */
type TNextObserver<A> = {
  readonly closed?: boolean
  readonly next: (value: A) => void
  readonly error?: (err: unknown) => void
  readonly complete?: () => void
}
type TErrorObserver<A> = {
  readonly closed?: boolean
  readonly next?: (value: A) => void
  readonly error: (err: unknown) => void
  readonly complete?: () => void
}
type TCompletionObserver<A> = {
  readonly closed?: boolean
  readonly next?: (value: A) => void
  readonly error?: (err: unknown) => void
  readonly complete: () => void
}
/* eslint-enable functional/no-return-void */
type TPartialObserver<T> = TNextObserver<T> | TErrorObserver<T> | TCompletionObserver<T>

export type TObservable<A> = Omit<rxjs.Observable<A>, 'subscribe'> & {
  readonly subscribe: (subscriber: TPartialObserver<A>) => rxjs.Subscription
}

const fromReadonlyArray: <A>(fa: List<A>) => TObservable<A> = rxjs.from

const fromSubscribe = <A>(
  subscribe: (subscriber: rxjs.Subscriber<A>) => rxjs.TeardownLogic,
): TObservable<A> => new rxjs.Observable<A>(subscribe) as TObservable<A>

const flattenTry = <A>(obs: TObservable<Try<A>>): TObservable<A> =>
  fromSubscribe<A>(subscriber => {
    const subscription = obs.subscribe({
      next: Try.fold(
        e => subscriber.error(e),
        a => subscriber.next(a),
      ),
      error: e => subscriber.error(e),
      complete: () => subscriber.complete(),
    })
    return () => subscription.unsubscribe()
  })

const fromTaskEither: <A>(fa: Future<A>) => TObservable<A> = flow(observable.fromTask, flattenTry)

const map = observable.map as unknown as <A, B>(
  f: (a: A) => B,
) => (fa: TObservable<A>) => TObservable<B>

const chain = observable.chain as unknown as <A, B>(
  f: (a: A) => TObservable<B>,
) => (ma: TObservable<A>) => TObservable<B>
const chainTaskEitherK = <A, B>(f: (a: A) => Future<B>): ((fa: TObservable<A>) => TObservable<B>) =>
  chain(flow(f, fromTaskEither))
const chainIOEitherK = <A, B>(f: (a: A) => IO<B>): ((fa: TObservable<A>) => TObservable<B>) =>
  chainTaskEitherK(flow(f, Future.fromIOEither))

const chainFirst = observable.chainFirst as unknown as <A, B>(
  f: (a: A) => TObservable<B>,
) => (ma: TObservable<A>) => TObservable<A>
const chainFirstTaskEitherK = <A, B>(
  f: (a: A) => Future<B>,
): ((fa: TObservable<A>) => TObservable<A>) => chainFirst(flow(f, fromTaskEither))
const chainFirstIOEitherK = <A, B>(f: (a: A) => IO<B>): ((fa: TObservable<A>) => TObservable<A>) =>
  chainFirstTaskEitherK(flow(f, Future.fromIOEither))

type Filter = {
  <A, B extends A>(refinement: Refinement<A, B>): (fa: TObservable<A>) => TObservable<B>
  <A>(predicate: Predicate<A>): (fa: TObservable<A>) => TObservable<A>
}

const filter = observable.filter as unknown as Filter

const filterMap = observable.filterMap as unknown as <A, B>(
  f: (a: A) => Maybe<B>,
) => (fa: TObservable<A>) => TObservable<B>

const flatten = observable.flatten as unknown as <A>(
  mma: TObservable<TObservable<A>>,
) => TObservable<A>

export const TObservable = {
  fromReadonlyArray,
  fromSubscribe,
  fromReadable: (stream: Readable): TObservable<unknown> => rxjsStream.streamToRx(stream),
  fromTaskEither,
  throwError: (e: Error): TObservable<never> => rxjs.throwError(e),
  map,
  chain,
  chainTaskEitherK,
  chainIOEitherK,
  chainFirst,
  chainFirstTaskEitherK,
  chainFirstIOEitherK,
  filter,
  filterMap,
  flatten,
  flattenTry,
  concat:
    <B>(fb: TObservable<B>) =>
    <A>(fa: TObservable<A>): TObservable<A | B> =>
      rxjs.concat(fa as rxjs.Observable<A>, fb as rxjs.Observable<B>),
  chunksOf:
    (n: number) =>
    <A>(fa: TObservable<A>): TObservable<NonEmptyArray<A>> => {
      const res: TObservable<List<A>> = fa.pipe(rxjsOperators.bufferCount(n))
      return res as TObservable<NonEmptyArray<A>>
    },
  subscribe:
    <A>({ next }: TObserver<A>) =>
    (fa: TObservable<A>): IO<rxjs.Subscription> => {
      const subscriber: rxjs.PartialObserver<A> = { next: a => Future.runUnsafe(next(a)) }
      return IO.tryCatch(() => fa.subscribe(subscriber))
    },
}
