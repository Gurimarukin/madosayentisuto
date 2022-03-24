import { task } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { Future, Maybe, Try } from '../../../src/shared/utils/fp'
import { futureMaybe } from '../../../src/shared/utils/futureMaybe'

describe('futureMaybe.chainFirst', () => {
  const futureToto = Future.right(Maybe.some('toto'))

  it('should Future.right(Maybe.some(123))', () =>
    pipe(
      Future.right(Maybe.some(123)),
      futureMaybe.chainFirst(() => futureToto),
      task.map(res => {
        expect(res).toStrictEqual(Try.right(Maybe.some(123)))
      }),
    )())

  it('should Future.right(Maybe.none)', () =>
    pipe(
      Future.right(Maybe.none),
      futureMaybe.chainFirst(() => futureToto),
      task.map(res => {
        expect(res).toStrictEqual(Try.right(Maybe.none))
      }),
    )())

  it('should Future.left(Error)', () =>
    pipe(
      Future.left(Error('my error')),
      futureMaybe.chainFirst(() => futureToto),
      task.map(res => {
        expect(res).toStrictEqual(Try.left(Error('my error')))
      }),
    )())
})
