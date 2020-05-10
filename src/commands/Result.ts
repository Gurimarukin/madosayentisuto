import { Alt1 } from 'fp-ts/lib/Alt'
import { sequenceT, Apply1 } from 'fp-ts/lib/Apply'
import { eqString } from 'fp-ts/lib/Eq'
import { Lazy } from 'fp-ts/lib/function'
import { pipeable } from 'fp-ts/lib/pipeable'
import { Semigroup } from 'fp-ts/lib/Semigroup'

import { Either, flow, pipe, List, Maybe } from '../utils/fp'
import { StringUtils } from '../utils/StringUtils'

declare module 'fp-ts/lib/HKT' {
  interface URItoKind<A> {
    readonly Result: Result<A>
  }
}

const URI = 'Result'
type URI = typeof URI

export interface Result<A> {
  readonly get: Either<Result.Failure, Lazy<Either<string[], A>>>
}

export function Result<A>(get: Either<Result.Failure, Lazy<Either<string[], A>>>): Result<A> {
  return { get }
}

export namespace Result {
  /**
   * Missing
   */
  interface Missing {
    readonly commands: string[]
    readonly argument: boolean
  }

  function Missing({ commands = List.empty, argument = false }: Partial<Missing> = {}): Missing {
    return { commands, argument }
  }

  namespace Missing {
    export const semigroup: Semigroup<Missing> = {
      concat: (x: Missing, y: Missing): Missing =>
        Missing({
          commands: List.concat(x.commands, y.commands),
          argument: x.argument || y.argument
        })
    }

    export const message = (missing: Missing): string => {
      const commandString = List.isEmpty(missing.commands)
        ? Maybe.none
        : Maybe.some(
            pipe(
              missing.commands,
              List.uniq(eqString),
              StringUtils.mkString('command (', ' or ', ')')
            )
          )

      const argString = missing.argument ? Maybe.some('positional argument') : Maybe.none

      return pipe(
        List.compact([commandString, argString]),
        StringUtils.mkString('Missing expected ', ', or ', '')
      )
    }
  }

  /**
   * Failure
   */
  export interface Failure {
    readonly reversedMissing: Missing[]
  }

  export function Failure(reversedMissing: Missing[]): Failure {
    return { reversedMissing }
  }

  export namespace Failure {
    export const semigroup: Semigroup<Failure> = {
      concat: (x: Failure, y: Failure): Failure =>
        Failure(List.concat(y.reversedMissing, x.reversedMissing))
    }

    export const messages = (failure: Failure): string[] =>
      pipe(failure.reversedMissing, List.reverse, List.map(Missing.message))
  }

  /**
   * methods
   */
  const resultValidation = Either.getValidation(Result.Failure.semigroup)
  const stringsValidation = Either.getValidation(List.getMonoid<string>())

  export const result: Apply1<URI> & Alt1<URI> = {
    URI,
    map: <A, B>(fa: Result<A>, f: (a: A) => B): Result<B> =>
      mapValidated(flow(f, Either.right))(fa),
    ap: <A, B>(fab: Result<(a: A) => B>, fa: Result<A>): Result<B> =>
      Result(
        pipe(
          sequenceT(resultValidation)(fab.get, fa.get),
          Either.map(([fab, fa]) => () =>
            pipe(
              sequenceT(stringsValidation)(fab(), fa()),
              Either.map(([f, a]) => f(a))
            )
          )
        )
      ),
    alt: <A>(fx: Result<A>, fy: () => Result<A>): Result<A> => {
      if (Either.isRight(fx.get)) return fx
      const y = fy()
      if (Either.isRight(y.get)) return y

      if (List.isEmpty(y.get.left.reversedMissing)) return fx
      if (List.isEmpty(fx.get.left.reversedMissing)) return y

      return pipe(
        List.zip(fx.get.left.reversedMissing, y.get.left.reversedMissing),
        List.map(([a, b]) => Missing.semigroup.concat(a, b)),
        failure
      )
    }
  }

  export const mapValidated = <A, B>(f: (a: A) => Either<string[], B>) => (
    res: Result<A>
  ): Result<B> =>
    Result(
      pipe(
        res.get,
        Either.map(_ => () => pipe(_(), Either.chain(f)))
      )
    )

  export const { map, ap, alt } = pipeable(result)

  /**
   * helpers
   */
  export const success = <A>(value: A): Result<A> => Result(Either.right(() => Either.right(value)))

  export const failure = (reversedMissing: Missing[]): Result<never> =>
    Result(Either.left(Failure(reversedMissing)))

  export const missingCommand = (command: string): Result<never> =>
    failure([Missing({ commands: [command] })])

  export const missingArgument: Result<never> = failure([Missing({ argument: true })])
}
