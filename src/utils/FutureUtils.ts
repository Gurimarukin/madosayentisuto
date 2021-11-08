import { task } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { MsDuration } from '../models/MsDuration'
import { Either, Future, IO } from './fp'

type OnComplete<A> = Readonly<{
  readonly onFailure: (e: Error) => IO<void>
  readonly onSuccess: (a: A) => IO<void>
}>

const retryIfFailed =
  <A>(delay: MsDuration, onComplete: OnComplete<A>) =>
  (f: Future<A>): Future<A> =>
    retryIfFailedRec(f, delay, onComplete, true)

const retryIfFailedRec = <A>(
  f: Future<A>,
  delay: MsDuration,
  onComplete: OnComplete<A>,
  firstTime: boolean,
): Future<A> => {
  const { onFailure, onSuccess } = onComplete
  return pipe(
    f,
    task.chain(
      Either.fold(
        e =>
          pipe(
            firstTime ? onFailure(e) : IO.unit,
            Future.fromIOEither,
            Future.chain(() => retryIfFailedRec(f, delay, onComplete, false)),
            Future.delay(delay),
          ),
        a =>
          pipe(
            onSuccess(a),
            Future.fromIOEither,
            Future.map(() => a),
          ),
      ),
    ),
  )
}

export const FutureUtils = { retryIfFailed }
