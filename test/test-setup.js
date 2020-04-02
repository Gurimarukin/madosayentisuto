const _Array = require('fp-ts/lib/Array')
const _Record = require('fp-ts/lib/Record')
const _Option = require('fp-ts/lib/Option')
const _Either = require('fp-ts/lib/Either')
const _Task = require('fp-ts/lib/TaskEither')
const _IOEither = require('fp-ts/lib/IOEither')
const _identity = require('fp-ts/lib/function').identity
const _pipe = require('fp-ts/lib/pipeable').pipe

const _Do = require('fp-ts-contrib/lib/Do').Do

global.todo = (..._) => {
  throw Error('missing implementation')
}
global.List = _Array
global.Dict = _Record
global.Maybe = _Option
global.Either = _Either
global.Future = _Task
global.IO = _IOEither
global.identity = _identity
global.pipe = _pipe
global.Do = _Do
