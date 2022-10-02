import type { io } from 'fp-ts'

export type Store<A> = {
  readonly get: io.IO<A>
  readonly set: <B extends A>(a: B) => io.IO<B>
  readonly modify: <B extends A>(f: (s: A) => B) => io.IO<B>
}

export const Store = <A>(init: A): Store<A> => {
  // eslint-disable-next-line functional/no-let
  let value = init

  const modify =
    <B extends A>(f: (s: A) => B): io.IO<B> =>
    () => {
      const newValue = f(value)
      // eslint-disable-next-line functional/no-expression-statement
      value = newValue
      return newValue
    }

  return {
    get: () => value,
    set: <B extends A>(a: B): io.IO<B> => modify(() => a),
    modify,
  }
}
