/* eslint-disable functional/no-return-void, functional/no-expression-statement */
import { io } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { RandomUtils } from '../../../src/shared/utils/RandomUtils'
import type { Tuple } from '../../../src/shared/utils/fp'
import { List, NonEmptyArray, Try } from '../../../src/shared/utils/fp'

const { __testableRandomPop: randomPop } = RandomUtils

describe('RandomUtils.randomPop', () => {
  it('should pop', () => {
    expect(randomPop([1])()).toStrictEqual([1, []])

    pipe(
      randomPop([1, 2]),
      io.map(altExpect<Tuple<number, List<number>>>([1, [2]], [2, [1]])),
      nTimes(100),
    )

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
  (result: A): void =>
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

const tryCatch = <A>(a: A, b: A): Try<void> => Try.tryCatch(() => expect(a).toStrictEqual(b))
