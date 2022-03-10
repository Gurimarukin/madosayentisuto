import { apply } from 'fp-ts'
import { flow } from 'fp-ts/function'

import type { List } from '../utils/fp'
import { Either, Maybe, NonEmptyArray } from '../utils/fp'

const fromEither: <E, A>(either: Either<E, A>) => ValidatedNea<E, A> = Either.mapLeft(
  NonEmptyArray.of,
)

const fromOption = <E, A>(onNone: () => E): ((ma: Maybe<A>) => ValidatedNea<E, A>) =>
  flow(Either.fromOption(onNone), fromEither)

const fromEmptyE = <E, A>(e: E): ((either: Either<List<E>, A>) => ValidatedNea<E, A>) =>
  Either.mapLeft(
    flow(
      NonEmptyArray.fromReadonlyArray,
      Maybe.getOrElse(() => NonEmptyArray.of(e)),
    ),
  )

const fromEmptyErrors: <A>(either: Either<List<string>, A>) => ValidatedNea<string, A> = fromEmptyE(
  'Got empty Errors from codec',
)

// ValidatedNea<string, A>
const stringValidation = Either.getApplicativeValidation(NonEmptyArray.getSemigroup<string>())

const sequenceS = apply.sequenceS(stringValidation)

export type ValidatedNea<E, A> = Either<NonEmptyArray<E>, A>

export const ValidatedNea = {
  fromEither,
  fromOption,
  fromEmptyE,
  fromEmptyErrors,
  stringValidation,
  sequenceS,
}
