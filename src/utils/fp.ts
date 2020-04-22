import * as _Array from 'fp-ts/lib/Array'
import * as _NonEmptyArray from 'fp-ts/lib/NonEmptyArray'
import * as _Record from 'fp-ts/lib/Record'
import * as _Option from 'fp-ts/lib/Option'
import * as _Either from 'fp-ts/lib/Either'
import * as _Task from 'fp-ts/lib/Task'
import * as _TaskEither from 'fp-ts/lib/TaskEither'
import * as _IO from 'fp-ts/lib/IO'
import * as _IOEither from 'fp-ts/lib/IOEither'
import { identity as _identity, Predicate, Lazy } from 'fp-ts/lib/function'
import { pipe as _pipe } from 'fp-ts/lib/pipeable'

import { Do as _Do } from 'fp-ts-contrib/lib/Do'

export const unknownToError = (e: unknown): Error =>
  e instanceof Error ? e : new Error('unknown error')

/**
 * ???
 */
export const todo = (..._: any): never => {
  throw Error('missing implementation')
}

/**
 * Array
 */
export const List = {
  ..._Array,

  exists: <A>(predicate: Predicate<A>) => (l: A[]): boolean =>
    pipe(l, List.findIndex(predicate), Maybe.isSome)
}

/**
 * NonEmptyArray
 */
export type NonEmptyArray<A> = _NonEmptyArray.NonEmptyArray<A>
export const NonEmptyArray = _NonEmptyArray

/**
 * Record
 */
export type Dict<A> = Record<string, A>
export const Dict = _Record

/**
 * Option
 */
export type Maybe<A> = _Option.Option<A>
export const Maybe = _Option

/**
 * Either
 */
export type Either<E, A> = _Either.Either<E, A>
export const Either = _Either

/**
 * Try
 */
export type Try<A> = Either<Error, A>
export const Try = {
  right: <A>(a: A): Try<A> => Either.right(a),

  apply: <A>(a: Lazy<A>): Try<A> => Either.tryCatch(a, unknownToError),

  get: <A>(t: Try<A>): A =>
    pipe(
      t,
      Either.getOrElse<Error, A>(e => {
        throw e
      })
    )
}

/**
 * Task
 */
export type Task<A> = _Task.Task<A>
export const Task = _Task

/**
 * Future
 */
export type Future<A> = _Task.Task<Try<A>>
export const Future = {
  ..._TaskEither,

  apply: <A>(f: Lazy<Promise<A>>): Future<A> => Future.tryCatch(f, unknownToError),

  unit: _TaskEither.right(undefined),

  parallel: <A>(futures: Future<A>[]): Future<A[]> =>
    List.array.sequence(Future.taskEither)(futures),

  sequence: <A>(futures: Future<A>[]): Future<A[]> =>
    List.array.sequence(Future.taskEitherSeq)(futures),

  runUnsafe: <A>(future: Future<A>): Promise<A> => pipe(future, _Task.map(Try.get))()
}

/**
 * IO
 */
export type IO<A> = _IO.IO<Try<A>>
export const IO = {
  ..._IOEither,

  apply: <A>(a: Lazy<A>): IO<A> => IO.tryCatch(a, unknownToError),

  unit: _IOEither.right(undefined),

  runFuture: <A>(f: Future<A>): IO<void> =>
    IO.apply(() => {
      Future.runUnsafe(f)
    }),

  runUnsafe: <A>(io: IO<A>): A => Try.get(io())
}

/**
 * identity
 */
export const identity = _identity

/**
 * pipe
 */
export const pipe = _pipe

/**
 * Do
 */
export const Do = _Do
