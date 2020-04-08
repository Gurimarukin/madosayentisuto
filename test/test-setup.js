const _Array = require('fp-ts/lib/Array')
const _Record = require('fp-ts/lib/Record')
const _Option = require('fp-ts/lib/Option')
const _Either = require('fp-ts/lib/Either')
const _Task = require('fp-ts/lib/TaskEither')
const _IOEither = require('fp-ts/lib/IOEither')
const Eq = require('fp-ts/lib/Eq')
const _identity = require('fp-ts/lib/function').identity
const _pipe = require('fp-ts/lib/pipeable').pipe

const _Do = require('fp-ts-contrib/lib/Do').Do

global.todo = (..._) => {
  throw Error('missing implementation')
}
global.List = _Array
global.List.exists = predicate => l => pipe(l, List.findIndex(predicate), Maybe.isSome)
global.List.contains = a => l => List.elem(Eq.fromEquals((a, b) => isDeepStrictEqual(a, b)))(a, l)
global.Dict = _Record
global.Maybe = _Option
global.Either = _Either
global.Future = _Task
global.Future.apply = f => Future.tryCatch(f, unknownToError)
global.Future.unit = Future.right(undefined)
global.Future.parallel = futures => List.array.sequence(Future.taskEither)(futures)
global.Future.sequence = futures => List.array.sequence(Future.taskEitherSeq)(futures)
global.Future.runUnsafe = future =>
  pipe(
    future,
    Task.map(_ =>
      pipe(
        _,
        Either.getOrElse(e => {
          throw e
        })
      )
    )
  )()
global.IO = _IOEither
global.IO.apply = f => IO.tryCatch(f, unknownToError)
global.IO.unit = IO.right(undefined)
global.IO.runFuture = f =>
  IO.apply(() => {
    Future.runUnsafe(f)
  })
global.IO.runUnsafe = io =>
  pipe(
    io(),
    Either.getOrElse(e => {
      throw e
    })
  )
global.identity = _identity
global.pipe = _pipe
global.Do = _Do
