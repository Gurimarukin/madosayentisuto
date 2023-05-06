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
        expectT(res).toStrictEqual(Try.success(Maybe.some(123)))
      }),
    )())

  it('should futureMaybe.none', () =>
    pipe(
      futureMaybe.none,
      futureMaybe.chainFirst(() => futureToto),
      task.map(res => {
        expectT(res).toStrictEqual(Try.success(Maybe.none))
      }),
    )())

  it('should Future.left(Error)', () =>
    pipe(
      Future.failed(Error('my error')),
      futureMaybe.chainFirst(() => futureToto),
      task.map(res => {
        expectT(res).toStrictEqual(Try.failure(Error('my error')))
      }),
    )())
})
