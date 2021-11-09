import { pipe } from 'fp-ts/function'
import { Either, Future } from 'shared/utils/fp'

describe('Future.orElse', () => {
  it("should return f if it isn't failed", () => {
    const res = pipe(
      Future.right<string>('toto'),
      Future.orElse(() => Future.right('titi')),
    )()
    return res.then(r => expect(r).toStrictEqual(Either.right('toto')))
  })

  it('should return first matching recovery', () => {
    const res = pipe(
      Future.left<string>(SyntaxError('this is an error')),
      Future.orElse(e =>
        e instanceof EvalError
          ? Future.right('eval error')
          : e instanceof SyntaxError
          ? Future.right('syntax error')
          : e.message === 'this is an error'
          ? Future.right('error message')
          : Future.left(e),
      ),
    )()
    return res.then(r => expect(r).toStrictEqual(Either.right('syntax error')))
  })

  it('should return f if no matching error', () => {
    const res = pipe(
      Future.left<string>(SyntaxError('this is an error')),
      Future.orElse(e =>
        e instanceof EvalError
          ? Future.right('eval error')
          : e.message === 'another message'
          ? Future.right('error message')
          : Future.left(e),
      ),
    )()
    return res.then(r => expect(r).toStrictEqual(Either.left(SyntaxError('this is an error'))))
  })
})
