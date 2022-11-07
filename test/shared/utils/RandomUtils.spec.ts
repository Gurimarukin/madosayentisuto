/* eslint-disable functional/no-return-void  */
import { io } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { RandomUtils } from '../../../src/shared/utils/RandomUtils'
import type { Tuple } from '../../../src/shared/utils/fp'
import { List, NonEmptyArray, Try } from '../../../src/shared/utils/fp'

import { expectT } from '../../expectT'

const { __testableRandomPop: randomPop } = RandomUtils

describe('RandomUtils.randomPop', () => {
  it('should pop', () => {
    expectT(randomPop([1])()).toStrictEqual([1, []])

    // eslint-disable-next-line functional/no-expression-statement
    pipe(
      randomPop([1, 2]),
      io.map(altExpect<Tuple<number, List<number>>>([1, [2]], [2, [1]])),
      nTimes(100),
    )

    // eslint-disable-next-line functional/no-expression-statement
    pipe(
      randomPop([1, 2, 3]),
      io.map(
        altExpect<Tuple<number, List<number>>>(
          [1, [2, 3]],
          [1, [3, 2]],
          [2, [3, 1]],
          [2, [1, 3]],
          [3, [1, 2]],
          [3, [2, 1]],
        ),
      ),
      nTimes(100),
    )
  })
})

const nTimes =
  (n: number) =>
  (ioA: io.IO<void>): void =>
    pipe(
      NonEmptyArray.range(0, n),
      NonEmptyArray.map(() => ioA),
      List.sequence(io.Applicative),
      io.map(() => undefined),
    )()

const altExpect =
  <A>(a: A, ...as: NonEmptyArray<A>) =>
  (result: A): A =>
    pipe(
      as,
      NonEmptyArray.reduce(tryCatch(result, a), (acc, a_) =>
        pipe(
          acc,
          Try.orElse(() => tryCatch(result, a_)),
        ),
      ),
      Try.getUnsafe,
    )

const tryCatch = <A>(a: A, b: A): Try<A> => Try.tryCatch(() => expectT(a).toStrictEqual(b))
