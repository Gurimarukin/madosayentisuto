import { isDeepStrictEqual } from 'util'

import * as _Array from 'fp-ts/lib/Array'
import * as _Record from 'fp-ts/lib/Record'
import * as _Option from 'fp-ts/lib/Option'
import * as _Either from 'fp-ts/lib/Either'
import * as Task from 'fp-ts/lib/Task'
import * as _Task from 'fp-ts/lib/TaskEither'
import * as _IOEither from 'fp-ts/lib/IOEither'
import * as Eq from 'fp-ts/lib/Eq'
import { identity as _identity, Predicate, Lazy } from 'fp-ts/lib/function'
import { pipe as _pipe } from 'fp-ts/lib/pipeable'

import { Do as _Do } from 'fp-ts-contrib/lib/Do'

import { unknownToError } from './utils/unknownToError'

export {}

/**
 * ???
 */
declare global {
  function todo(...args: any[]): never
}

;(global as any).todo = (..._: any): never => {
  throw Error('missing implementation')
}

/**
 * Array
 */
declare global {
  export const List: typeof _Array & {
    exists: ArrayExists
    contains: ArrayContains
  }
}

type ArrayExists = <A>(predicate: Predicate<A>) => (l: A[]) => boolean
type ArrayContains = <A>(a: A) => (l: A[]) => boolean

const arrayExists: ArrayExists = predicate => l => pipe(l, List.findIndex(predicate), Maybe.isSome)
const arrayContains: ArrayContains = a => l =>
  List.elem(Eq.fromEquals((a, b) => isDeepStrictEqual(a, b)))(a, l)

;(global as any).List = _Array
;(global as any).List.exists = arrayExists
;(global as any).List.contains = arrayContains

/**
 * Record
 */
declare global {
  export type Dict<A> = Record<string, A>
  export const Dict: typeof _Record
}

;(global as any).Dict = _Record

/**
 * Option
 */
declare global {
  export type Maybe<A> = _Option.Option<A>
  export const Maybe: typeof _Option
}

;(global as any).Maybe = _Option

/**
 * Either
 */
declare global {
  export type Either<E, A> = _Either.Either<E, A>
  export const Either: typeof _Either
}

;(global as any).Either = _Either

/**
 * Future
 */
declare global {
  export type Future<A> = _Task.TaskEither<Error, A>
  export const Future: typeof _Task & {
    apply: FutureApply
    unit: Future<void>
    parallel: FutureParallel
    sequence: FutureSequence
    runUnsafe: FutureRunUnsafe
  }
}

type FutureApply = <A>(f: Lazy<Promise<A>>) => Future<A>
type FutureParallel = <A>(futures: Future<A>[]) => Future<A[]>
type FutureSequence = <A>(futures: Future<A>[]) => Future<A[]>
type FutureRunUnsafe = <A>(future: Future<A>) => Promise<A>

const futureApply: FutureApply = f => Future.tryCatch(f, unknownToError)
const futureParallel: FutureParallel = futures => List.array.sequence(Future.taskEither)(futures)
const futureSequence: FutureSequence = futures => List.array.sequence(Future.taskEitherSeq)(futures)
const futureRunUnsafe: FutureRunUnsafe = <A>(future: Future<A>) =>
  pipe(
    future,
    Task.map(_ =>
      pipe(
        _,
        Either.getOrElse<Error, A>(e => {
          throw e
        })
      )
    )
  )()

;(global as any).Future = _Task
;(global as any).Future.apply = futureApply
;(global as any).Future.unit = Future.right(undefined)
;(global as any).Future.parallel = futureParallel
;(global as any).Future.sequence = futureSequence
;(global as any).Future.runUnsafe = futureRunUnsafe

/**
 * IO
 */
declare global {
  export type IO<A> = _IOEither.IOEither<Error, A>
  export const IO: typeof _IOEither & {
    apply: IOApply
    unit: IO<void>
    runFuture: IORunFuture
    runUnsafe: IORunUnsafe
  }
}

type IOApply = <A>(a: Lazy<A>) => IO<A>
type IORunFuture = <A>(f: Future<A>) => IO<void>
type IORunUnsafe = <A>(io: IO<A>) => A

const ioApply: IOApply = f => IO.tryCatch(f, unknownToError)
const ioFromFuture: IORunFuture = f =>
  IO.apply(() => {
    Future.runUnsafe(f)
  })
const ioRunUnsafe: IORunUnsafe = <A>(io: IO<A>) =>
  pipe(
    io(),
    Either.getOrElse<Error, A>(e => {
      throw e
    })
  )

;(global as any).IO = _IOEither
;(global as any).IO.apply = ioApply
;(global as any).IO.unit = IO.right(undefined)
;(global as any).IO.runFuture = ioFromFuture
;(global as any).IO.runUnsafe = ioRunUnsafe

/**
 * identity
 */
declare global {
  export const identity: typeof _identity
}

;(global as any).identity = _identity

/**
 * pipe
 */
declare global {
  export const pipe: typeof _pipe
}

;(global as any).pipe = _pipe

/**
 * Do
 */
declare global {
  export const Do: typeof _Do
}

;(global as any).Do = _Do
