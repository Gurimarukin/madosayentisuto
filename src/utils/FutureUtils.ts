import { MsDuration } from '../models/MsDuration'
import { Either, Future, IO, Task, pipe } from './fp'

type OnComplete<A> = Readonly<{
  readonly onFailure: (e: Error) => IO<void>
  readonly onSuccess: (a: A) => IO<void>
}>

export namespace FutureUtils {
  export function retryIfFailed<A>(
    delay: MsDuration,
    onComplete: OnComplete<A>,
  ): (f: Future<A>) => Future<A> {
    return f => retryIfFailedRec(f, delay, onComplete, true)
  }
}

function retryIfFailedRec<A>(
  f: Future<A>,
  delay: MsDuration,
  onComplete: OnComplete<A>,
  firstTime: boolean,
): Future<A> {
  const { onFailure, onSuccess } = onComplete
  return pipe(
    f,
    Task.chain(
      Either.fold(
        e =>
          pipe(
            firstTime ? onFailure(e) : IO.unit,
            Future.fromIOEither,
            Future.chain(_ => retryIfFailedRec(f, delay, onComplete, false)),
            Future.delay(delay),
          ),
        a =>
          pipe(
            Future.fromIOEither(onSuccess(a)),
            Future.map(_ => a),
          ),
      ),
    ),
  )
}
