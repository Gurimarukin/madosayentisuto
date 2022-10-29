import { apply } from 'fp-ts'
import type { Applicative2C } from 'fp-ts/Applicative'
import { flow } from 'fp-ts/function'

import type { Dict, List } from '../utils/fp'
import { Either, Maybe, NonEmptyArray } from '../utils/fp'

type ValidatedNea<E, A> = Either<NonEmptyArray<E>, A>

const valid: <E = never, A = never>(a: A) => ValidatedNea<E, A> = Either.right

const invalid: <E = never, A = never>(e: E) => ValidatedNea<E, A> = flow(
  NonEmptyArray.of,
  Either.left,
)

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

const getValidation = <E = never>(): Applicative2C<'Either', NonEmptyArray<E>> =>
  Either.getApplicativeValidation(NonEmptyArray.getSemigroup<E>())

type ToValidatedDict<E, A extends Dict<string, unknown>> = {
  readonly [K in keyof A]: ValidatedNea<E, A[K]>
}

type SeqS<E> = <A extends Dict<string, unknown>>(a: ToValidatedDict<E, A>) => ValidatedNea<E, A>

const getSeqS = <E = never>(): SeqS<E> => apply.sequenceS(getValidation<E>()) as SeqS<E>

const ValidatedNea = {
  valid,
  invalid,
  fromEither,
  fromOption,
  fromEmptyE,
  fromEmptyErrors,
  getValidation,
  getSeqS,
}

export { ValidatedNea }
