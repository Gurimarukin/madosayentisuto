import * as _Array from 'fp-ts/lib/Array'
import * as _Option from 'fp-ts/lib/Option'
import * as _Either from 'fp-ts/lib/Either'
import * as _Task from 'fp-ts/lib/TaskEither'
import * as _IOEither from 'fp-ts/lib/IOEither'
import { identity as _identity } from 'fp-ts/lib/function'
import { pipe as _pipe } from 'fp-ts/lib/pipeable'

import { Do as _Do } from 'fp-ts-contrib/lib/Do'

export {}

declare global {
  function todo(...args: any[]): never

  export type Seq<A> = Array<A>
  export const Seq: typeof _Array

  export type Maybe<A> = _Option.Option<A>
  export const Maybe: typeof _Option

  export type Either<E, A> = _Either.Either<E, A>
  export const Either: typeof _Either

  export type Future<A> = _Task.TaskEither<unknown, A>
  export const Future: typeof _Task

  export type IO<A> = _IOEither.IOEither<unknown, A>
  export const IO: typeof _IOEither

  export const identity: typeof _identity

  export const pipe: typeof _pipe

  export const Do: typeof _Do
}

;(global as any).todo = (..._: any): never => {
  throw Error('missing implementation')
}
;(global as any).Seq = _Array
;(global as any).Maybe = _Option
;(global as any).Either = _Either
;(global as any).Future = _Task
;(global as any).IO = _IOEither
;(global as any).identity = _identity
;(global as any).pipe = _pipe
;(global as any).Do = _Do
