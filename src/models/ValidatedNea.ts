import { Either, NonEmptyArray, flow, Maybe } from '../utils/fp'

export type ValidatedNea<E, A> = Either<NonEmptyArray<E>, A>

export namespace ValidatedNea {
  export const fromEither: <E, A>(either: Either<E, A>) => ValidatedNea<E, A> = Either.mapLeft(
    NonEmptyArray.of
  )

  export const fromOption = <E, A>(onNone: () => E): ((ma: Maybe<A>) => ValidatedNea<E, A>) =>
    flow(Either.fromOption(onNone), fromEither)

  export const fromEmptyE = <E, A>(e: E): ((either: Either<E[], A>) => ValidatedNea<E, A>) =>
    Either.mapLeft(
      flow(
        NonEmptyArray.fromArray,
        Maybe.getOrElse(() => NonEmptyArray.of(e))
      )
    )

  export const fromEmptyErrors: <A>(
    either: Either<string[], A>
  ) => ValidatedNea<string, A> = fromEmptyE('Got empty Errors from codec')
}
