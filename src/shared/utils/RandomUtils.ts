import { io, random } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { List, NonEmptyArray, Tuple } from './fp'

const shuffle = <A>(nea: NonEmptyArray<A>): io.IO<NonEmptyArray<A>> =>
  nea.length === 1
    ? io.of(nea)
    : pipe(
        __testableRandomPop(nea),
        io.chain(([popped, remain]) => shuffleRec(NonEmptyArray.of(popped), remain)),
      )

const shuffleRec = <A>(acc: NonEmptyArray<A>, as: List<A>): io.IO<NonEmptyArray<A>> =>
  !List.isNonEmpty(as)
    ? io.of(acc)
    : pipe(
        __testableRandomPop(as),
        io.chain(([popped, remain]) => shuffleRec(pipe(acc, List.append(popped)), remain)),
      )

const __testableRandomPop = <A>(nea: NonEmptyArray<A>): io.IO<Tuple<A, List<A>>> =>
  nea.length === 1
    ? io.of(Tuple.of(NonEmptyArray.head(nea), List.empty))
    : pipe(
        random.randomInt(0, nea.length - 1),
        io.map(i => Tuple.of(nea[i] as A, List.unsafeDeleteAt(i, nea))),
      )

export const RandomUtils = {
  shuffle,
  /**
   * @deprecated
   */
  __testableRandomPop,
}
