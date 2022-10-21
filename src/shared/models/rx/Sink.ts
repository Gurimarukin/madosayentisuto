import { flow, identity, pipe } from 'fp-ts/function'

import type { List, NonIO } from '../../utils/fp'
import { Future, NotUsed } from '../../utils/fp'
import type { TObservable } from './TObservable'

export type Sink<A, B> = (observable: TObservable<A>) => Future<B>

const reduce =
  <A, B>(b: B, f: (acc: B, a: A) => B): Sink<A, B> =>
  obs =>
    Future.tryCatch(
      () =>
        new Promise<B>((resolve, reject) => {
          // eslint-disable-next-line functional/no-let
          let acc: B = b
          const subscription = obs.subscribe({
            /* eslint-disable functional/no-expression-statement */
            next: a => {
              acc = f(acc, a)
            },
            error: e => {
              subscription.unsubscribe()
              reject(e)
            },
            /* eslint-enable functional/no-expression-statement */
            complete: () => resolve(acc),
          })
        }),
    )

const reduceTaskEither = <A, B>(b: B, f: (acc: B, a: A) => Future<B>): Sink<A, B> =>
  flow(
    reduce(Future.right(b), (futureAcc, a) =>
      pipe(
        futureAcc,
        Future.chain(acc => f(acc, a)),
      ),
    ),
    Future.chain(identity),
  )

const readonlyArray = <A>(obs: TObservable<A>): Future<List<A>> =>
  Future.tryCatch(
    () =>
      new Promise<List<A>>((resolve, reject) => {
        // eslint-disable-next-line functional/prefer-readonly-type
        const acc: A[] = []
        const subscription = obs.subscribe({
          // eslint-disable-next-line functional/immutable-data
          next: a => acc.push(a),
          /* eslint-disable functional/no-expression-statement */
          error: e => {
            subscription.unsubscribe()
            reject(e)
          },
          /* eslint-enable functional/no-expression-statement */
          complete: () => resolve(acc),
        })
      }),
  )

const toNotUsed = <A>(obs: TObservable<NonIO<A>>): Future<NotUsed> =>
  Future.tryCatch(
    () =>
      new Promise<NotUsed>((resolve, reject) => {
        const subscription = obs.subscribe({
          next: () => undefined,
          /* eslint-disable functional/no-expression-statement */
          error: e => {
            subscription.unsubscribe()
            reject(e)
          },
          /* eslint-enable functional/no-expression-statement */
          complete: () => resolve(NotUsed),
        })
      }),
  )

export const Sink = { reduce, reduceTaskEither, readonlyArray, toNotUsed }
