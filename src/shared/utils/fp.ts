import type { io } from 'fp-ts'
import {
  either,
  ioEither,
  option,
  readonlyArray,
  readonlyNonEmptyArray,
  readonlyRecord,
  readonlyTuple,
  task,
  taskEither,
} from 'fp-ts'
import type { Predicate } from 'fp-ts/Predicate'
import type { Refinement } from 'fp-ts/Refinement'
import type { Lazy } from 'fp-ts/function'
import { identity } from 'fp-ts/function'
import { flow, pipe } from 'fp-ts/function'
import * as C_ from 'io-ts/Codec'
import type { Codec } from 'io-ts/Codec'
import * as D from 'io-ts/Decoder'
import type { Decoder } from 'io-ts/Decoder'
import type { Encoder } from 'io-ts/Encoder'

import { MsDuration } from '../models/MsDuration'

export const todo = (...[]: List<unknown>): never => {
  // eslint-disable-next-line functional/no-throw-statement
  throw Error('Missing implementation')
}

export const inspect =
  (...label: List<unknown>) =>
  <A>(a: A): A => {
    console.log(...label, a)
    return a
  }

// eslint-disable-next-line functional/no-return-void
export const noop = (): void => undefined

// a Future is an IO
type NonIO<A> = A extends io.IO<unknown> ? never : A

// eslint-disable-next-line @typescript-eslint/no-unused-vars, functional/no-return-void
export const toUnit = <A>(_: NonIO<A>): void => undefined

export type Dict<K extends string, A> = readonlyRecord.ReadonlyRecord<K, A>
export const Dict = readonlyRecord

export type Either<E, A> = either.Either<E, A>
export const Either = {
  ...either,
}

export type Maybe<A> = option.Option<A>
const maybeToArray: <A>(fa: Maybe<A>) => List<A> = option.fold(
  () => [],
  a => [a],
)
const maybeDecoder = <I, A>(decoder: Decoder<I, A>): Decoder<I, Maybe<A>> => ({
  decode: (u: I) =>
    u === null || u === undefined
      ? D.success(option.none)
      : pipe(decoder.decode(u), either.map(option.some)),
})
const maybeEncoder = <O, A>(encoder: Encoder<O, A>): Encoder<O | null, Maybe<A>> => ({
  encode: flow(option.map(encoder.encode), option.toNullable),
})
export const Maybe = {
  ...option,
  every: <A>(predicate: Predicate<A>): ((fa: Maybe<A>) => boolean) =>
    option.fold(() => true, predicate),
  toArray: maybeToArray,
  decoder: maybeDecoder,
  encoder: maybeEncoder,
  codec: <O, A>(codec: Codec<unknown, O, A>): Codec<unknown, O | null, Maybe<A>> =>
    C_.make(maybeDecoder(codec), maybeEncoder(codec)),
}

export type NonEmptyArray<A> = readonlyNonEmptyArray.ReadonlyNonEmptyArray<A>
const neaDecoder = <A>(decoder: Decoder<unknown, A>): Decoder<unknown, NonEmptyArray<A>> =>
  pipe(D.array(decoder), D.refine<List<A>, NonEmptyArray<A>>(List.isNonEmpty, 'NonEmptyArray'))
const neaEncoder = <O, A>(encoder: Encoder<O, A>): Encoder<NonEmptyArray<O>, NonEmptyArray<A>> => ({
  encode: NonEmptyArray.map(encoder.encode),
})
export const NonEmptyArray = {
  ...readonlyNonEmptyArray,
  decoder: neaDecoder,
  encoder: neaEncoder,
  codec: <O, A>(codec: Codec<unknown, O, A>): Codec<unknown, NonEmptyArray<O>, NonEmptyArray<A>> =>
    C_.make(neaDecoder(codec), neaEncoder(codec)),
}

// can't just alias it to `Array`
export type List<A> = ReadonlyArray<A>
const listDecoder: <A>(decoder: Decoder<unknown, A>) => Decoder<unknown, List<A>> = D.array
const listEncoder = <O, A>(encoder: Encoder<O, A>): Encoder<List<O>, List<A>> => ({
  encode: readonlyArray.map(encoder.encode),
})
export const List = {
  ...readonlyArray,
  isEmpty: <A>(l: List<A>): l is readonly [] => readonlyArray.isEmpty(l),
  hasLength1: <A>(l: List<A>): l is NonEmptyArray<A> => l.length === 1,
  concat: <A>(a: List<A>, b: List<A>): List<A> => [...a, ...b],
  decoder: listDecoder,
  encoder: listEncoder,
  codec: <O, A>(codec: Codec<unknown, O, A>): Codec<unknown, List<O>, List<A>> =>
    C_.make(listDecoder(codec), listEncoder(codec)),
}

export type Tuple<A, B> = readonly [A, B]
export const Tuple = {
  ...readonlyTuple,
  of: <A, B>(a: A, b: B): Tuple<A, B> => [a, b],
}

export type Tuple3<A, B, C> = readonly [A, B, C]

const unknownAsError = (e: unknown): Error => e as Error

export type Try<A> = Either<Error, A>
export const Try = {
  ...either,
  right: <A>(a: A): Try<A> => Either.right(a),
  left: <A = never>(e: Error): Try<A> => Either.left(e),
  tryCatch: <A>(a: Lazy<A>): Try<A> => Either.tryCatch(a, unknownAsError),
  getUnsafe: <A>(t: Try<A>): A =>
    pipe(
      t,
      Either.getOrElse<Error, A>(e => {
        // eslint-disable-next-line functional/no-throw-statement
        throw e
      }),
    ),
}

const futureRight = <A>(a: A): Future<A> => taskEither.right(a)
const futureFromIO: <A>(fa: io.IO<A>) => Future<A> = taskEither.fromIO
export type Future<A> = task.Task<Try<A>>
export const Future = {
  ...taskEither,
  right: futureRight,
  left: <A = never>(e: Error): Future<A> => taskEither.left(e),
  chainFirstIOEitherK:
    <A, B>(f: (a: A) => IO<B>) =>
    (fa: Future<A>): Future<A> =>
      pipe(fa, taskEither.chainFirst(flow(f, taskEither.fromIOEither))),
  orElseIOEitherK:
    <A>(f: (e: Error) => IO<A>) =>
    (fa: Future<A>): Future<A> =>
      pipe(fa, taskEither.orElse(flow(f, Future.fromIOEither))),
  fromIO: futureFromIO,
  tryCatch: <A>(f: Lazy<Promise<A>>): Future<A> => taskEither.tryCatch(f, unknownAsError),
  unit: futureRight<void>(undefined),
  runUnsafe: <A>(fa: Future<A>): Promise<A> => pipe(fa, task.map(Try.getUnsafe))(),
  delay:
    <A>(ms: MsDuration) =>
    (future: Future<A>): Future<A> =>
      pipe(future, task.delay(MsDuration.unwrap(ms))),
}

const ioRight = <A>(a: A): IO<A> => ioEither.right(a)
const ioTryCatch = <A>(a: Lazy<A>): IO<A> => ioEither.tryCatch(a, unknownAsError)
const ioFromIO: <A>(fa: io.IO<A>) => IO<A> = ioEither.fromIO
const ioRunUnsafe = <A>(ioA: IO<A>): A => Try.getUnsafe(ioA())
export type IO<A> = io.IO<Try<A>>
export const IO = {
  ...ioEither,
  right: ioRight,
  tryCatch: ioTryCatch,
  fromIO: ioFromIO,
  unit: ioRight<void>(undefined),
  runFutureUnsafe: <A>(f: Future<A>): IO<void> =>
    ioFromIO(() => {
      // eslint-disable-next-line functional/no-expression-statement
      Future.runUnsafe(f)
    }),
  runUnsafe: ioRunUnsafe,
  delay:
    (delay: MsDuration) =>
    (io_: IO<void>): IO<NodeJS.Timeout> =>
      IO.tryCatch(() => setTimeout(() => pipe(io_, ioRunUnsafe), MsDuration.unwrap(delay))),
}

export const refinementFromPredicate = identity as <A>(pred: Predicate<A>) => Refinement<A, A>
