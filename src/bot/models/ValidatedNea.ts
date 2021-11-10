import { flow } from 'fp-ts/function'

import type { List } from '../../shared/utils/fp'
import { Either, Maybe, NonEmptyArray } from '../../shared/utils/fp'

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

export type ValidatedNea<E, A> = Either<NonEmptyArray<E>, A>

export const ValidatedNea = { fromEither, fromOption, fromEmptyE, fromEmptyErrors }
