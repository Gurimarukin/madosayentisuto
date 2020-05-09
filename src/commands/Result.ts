import { eqString } from 'fp-ts/lib/Eq'
import { Lazy } from 'fp-ts/lib/function'

import { Either, pipe, List, Maybe, Do } from '../utils/fp'

export type Result<A> = Either<Result.Failure, Lazy<Either<string[], A>>>

export namespace Result {
  export const mapValidated = <A, B>(
    f: (a: A) => Either<string[], B>
  ): ((res: Result<A>) => Result<B>) => Either.map(_ => () => pipe(_(), Either.chain(f)))

  export const ap = <A, B>(ra: Result<A>) => (rab: Result<(a: A) => B>): Result<B> =>
    Do(Either.either)
      .bind('fa', ra)
      .bind('fab', rab)
      .return(({ fa, fab }) => () => Either.either.ap(fab(), fa()))

  interface Missing {
    readonly commands: string[]
    readonly argument: boolean
  }
  function Missing({ commands = List.empty, argument = false }: Partial<Missing> = {}): Missing {
    return { commands, argument }
  }
  namespace Missing {
    export const message = (missing: Missing): string => {
      const commandString = Maybe.fromPredicate(_ => !List.isEmpty(missing.commands))(
        `command (${pipe(missing.commands, List.uniq(eqString)).join(' or ')})`
      )

      const argString = Maybe.fromPredicate(_ => missing.argument)('positional argument')

      return `Missing expected ${List.compact([commandString, argString]).join(', or ')}!`
    }
  }

  export interface Failure {
    readonly reversedMissing: Missing[]
  }
  export function Failure(reversedMissing: Missing[]): Failure {
    return { reversedMissing }
  }
  export namespace Failure {
    export const messages = (failure: Failure): string[] =>
      pipe(failure.reversedMissing, List.reverse, List.map(Missing.message))
  }

  export const success = <A>(value: A): Result<A> => Either.right(() => Either.right(value))

  export const failure = (reversedMissing: Missing[]): Result<never> =>
    Either.left(Failure(reversedMissing))
  export const missingCommand = (command: string): Result<never> =>
    failure([Missing({ commands: [command] })])
  export const missingArgument: Result<never> = failure([Missing({ argument: true })])
}
