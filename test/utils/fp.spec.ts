import { Either, Future, pipe } from '../../src/utils/fp'

describe('Future.recover', () => {
  it("should return f if it isn't failed", () => {
    const res = pipe(Future.right<Error, string>('toto'), Future.recover([_ => true, 'titi']))()
    return res.then(_ => expect(_).toStrictEqual(Either.right('toto')))
  })

  it('should return first matching recovery', () => {
    const res = pipe(
      Future.left<Error, string>(SyntaxError('this is an error')),
      Future.recover(
        [e => e instanceof EvalError, 'eval error'],
        [e => e instanceof SyntaxError, 'syntax error'],
        [e => e.message === 'this is an error', 'error message']
      )
    )()
    return res.then(_ => expect(_).toStrictEqual(Either.right('syntax error')))
  })

  it('should return f if no matching error', () => {
    const res = pipe(
      Future.left<Error, string>(SyntaxError('this is an error')),
      Future.recover(
        [e => e instanceof EvalError, 'eval error'],
        [e => e.message === 'another message', 'error message']
      )
    )()
    return res.then(_ => expect(_).toStrictEqual(Either.left(SyntaxError('this is an error'))))
  })
})
