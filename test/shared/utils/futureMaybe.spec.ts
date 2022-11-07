import { task } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { Future, Maybe, Try } from '../../../src/shared/utils/fp'
import { futureMaybe } from '../../../src/shared/utils/futureMaybe'

import { expectT } from '../../expectT'

describe('futureMaybe.chainFirst', () => {
  const futureToto = futureMaybe.some('toto')

  it('should futureMaybe.some(123)', () =>
    pipe(
      futureMaybe.some(123),
      futureMaybe.chainFirst(() => futureToto),
      task.map(res => {
        expectT(res).toStrictEqual(Try.right(Maybe.some(123)))
      }),
    )())

  it('should futureMaybe.none', () =>
    pipe(
      futureMaybe.none,
      futureMaybe.chainFirst(() => futureToto),
      task.map(res => {
        expectT(res).toStrictEqual(Try.right(Maybe.none))
      }),
    )())

  it('should Future.left(Error)', () =>
    pipe(
      Future.left(Error('my error')),
      futureMaybe.chainFirst(() => futureToto),
      task.map(res => {
        expectT(res).toStrictEqual(Try.left(Error('my error')))
      }),
    )())
})
