import { Lazy } from 'fp-ts/lib/function'

import { Command } from './Command'
import { Diff } from '../models/Diff'
import { NonEmptyArray, Either, pipe } from '../utils/fp'

export type Opts<A> = Opts.Pure<A> | Opts.OrElse<A> | Opts.Argument<A> | Opts.Subcommand<A>

export namespace Opts {
  /**
   * Pure
   */
  export interface Pure<A> {
    readonly _tag: 'Pure'
    readonly a: A
  }
  export const pure = <A>(a: A): Opts<A> => ({ _tag: 'Pure', a })

  export const unit: Opts<void> = pure(undefined)

  export const isPure = <A>(opts: Opts<A>): opts is Pure<A> => opts._tag === 'Pure'

  /**
   * OrElse
   */
  export interface OrElse<A> {
    readonly _tag: 'OrElse'
    readonly a: Opts<A>
    readonly b: Lazy<Opts<A>>
  }

  export const OrElse = <A>(a: Opts<A>, b: Lazy<Opts<A>>): Opts<A> => ({ _tag: 'OrElse', a, b })

  export const isOrElse = <A>(opts: Opts<A>): opts is OrElse<A> => opts._tag === 'OrElse'

  /**
   * Argument
   */
  export interface Argument<A> {
    readonly _tag: 'Argument'
    readonly metavar: string
    readonly decode: (raw: string) => Either<string, A>
  }

  /**
   * Subcommand
   */
  export interface Subcommand<A> {
    readonly _tag: 'Subcommand'
    readonly command: Command<A>
  }

  export const isSubcommand = <A>(opts: Opts<A>): opts is Subcommand<A> =>
    opts._tag === 'Subcommand'

  /**
   * Helpers
   */
  export const argument = <A>(
    metavar: string,
    decode: (raw: string) => Either<string, A>
  ): Opts<A> => ({ _tag: 'Argument', metavar, decode })

  export const subcommand = <A>(command: Command<A>): Opts<A> => ({ _tag: 'Subcommand', command })

  export const map = <A, B>(f: (a: A) => B) => (opts: Opts<A>): Opts<B> =>
    pipe(
      opts,
      fold({
        onPure: a => pure(f(a)),
        onOrElse: (a, b) => OrElse(pipe(a, map(f)), () => pipe(b(), map(f))),
        onArgument: (m, d) => argument(m, u => pipe(d(u), Either.map(f))),
        onSubcommand: c => subcommand(pipe(c, Command.map(f)))
      })
    )

  export const orElse = <A>(b: Lazy<Opts<A>>) => (a: Opts<A>): Opts<A> => OrElse(a, b)

  export const flatten = <A>(opts: Opts<A>): NonEmptyArray<Diff<Opts<A>, Opts.OrElse<A>>> =>
    isOrElse(opts)
      ? NonEmptyArray.concat(flatten(opts.a), flatten(opts.b()))
      : NonEmptyArray.of(opts)
  export const fold = <A, B>({ onPure, onOrElse, onArgument, onSubcommand }: FoldArgs<A, B>) => (
    opts: Opts<A>
  ): B => {
    switch (opts._tag) {
      case 'Pure':
        return onPure(opts.a)
      case 'OrElse':
        return onOrElse(opts.a, opts.b)
      case 'Argument':
        return onArgument(opts.metavar, opts.decode)
      case 'Subcommand':
        return onSubcommand(opts.command)
    }
  }
}

interface FoldArgs<A, B> {
  onPure: (a: A) => B
  onOrElse: (a: Opts<A>, b: Lazy<Opts<A>>) => B
  onArgument: (metavar: string, decode: (raw: string) => Either<string, A>) => B
  onSubcommand: (command: Command<A>) => B
}
