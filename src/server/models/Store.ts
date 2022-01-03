import { IO } from '../../shared/utils/fp'

export type Store<A> = {
  readonly get: IO<A>
  readonly set: <B extends A>(a: B) => IO<B>
  readonly update: <B extends A>(f: (s: A) => B) => IO<B>
}

export const Store = <A>(init: A): Store<A> => {
  // eslint-disable-next-line functional/no-let
  let value = init

  const update = <B extends A>(f: (s: A) => B): IO<B> =>
    IO.fromIO(() => {
      const newValue = f(value)
      // eslint-disable-next-line functional/no-expression-statement
      value = f(value)
      return newValue
    })

  return {
    get: IO.fromIO(() => value),
    set: <B extends A>(a: B): IO<B> => update(() => a),
    update,
  }
}
