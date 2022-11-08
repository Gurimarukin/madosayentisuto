import { date, ord } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { Either, Future, NonEmptyArray } from '../../../src/shared/utils/fp'

import { expectT } from '../../expectT'

describe('Future.orElse', () => {
  it("should return f if it isn't failed", () => {
    const res = pipe(
      Future.right<string>('toto'),
      Future.orElse(() => Future.right('titi')),
    )()
    return res.then(r => expectT(r).toStrictEqual(Either.right('toto')))
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
    return res.then(r => expectT(r).toStrictEqual(Either.right('syntax error')))
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
    return res.then(r => expectT(r).toStrictEqual(Either.left(SyntaxError('this is an error'))))
  })
})

describe('date.Ord', () => {
  const date1 = { date: new Date('2020-01-01') }
  const date2 = { date: new Date('2020-01-02') }
  const date3 = { date: new Date('2020-01-03') }

  const dateOrd = pipe(
    date.Ord,
    ord.contramap((d: { readonly date: Date }) => d.date),
  )

  it('shoud NonEmptyArray.max', () => {
    expectT(pipe([date2, date3, date1], NonEmptyArray.max(dateOrd))).toStrictEqual(date3)

    expectT(pipe([date3, date1, date2], NonEmptyArray.min(dateOrd))).toStrictEqual(date1)
  })

  it('should ord.max', () => {
    expectT(ord.max(dateOrd)(date1, date2)).toStrictEqual(date2)
    expectT(ord.min(dateOrd)(date1, date2)).toStrictEqual(date1)
  })
})
