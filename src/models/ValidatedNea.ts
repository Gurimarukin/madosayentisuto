import { sequenceT } from 'fp-ts/lib/Apply'
import { getValidation } from 'fp-ts/lib/Either'
import { getSemigroup } from 'fp-ts/lib/NonEmptyArray'

import { Either, NonEmptyArray } from '../utils/fp'

export type ValidatedNea<E, A> = Either<NonEmptyArray<E>, A>

export namespace ValidatedNea {
  export const fromEither: <E, A>(either: Either<E, A>) => ValidatedNea<E, A> = Either.mapLeft(
    NonEmptyArray.of
  )

  export const sequence = <E, T extends NonEmptyArray<Either<NonEmptyArray<E>, any>>>(
    ...t: T
  ): Either<
    NonEmptyArray<E>,
    { [K in keyof T]: [T[K]] extends [Either<NonEmptyArray<E>, infer A>] ? A : never }
  > => sequenceT(getValidation(getSemigroup<E>()))(...t)
}
