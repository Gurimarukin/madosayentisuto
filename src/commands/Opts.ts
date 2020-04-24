import { Lazy } from 'fp-ts/lib/function'

import { Command } from './Command'
import { Diff } from '../models/Diff'
import { NonEmptyArray } from '../utils/fp'

export type Opts<A> = Opts.Pure<A> | Opts.Subcommand<A> | Opts.OrElse<A>

export namespace Opts {
  export interface Pure<A> {
    readonly _tag: 'Pure'
    readonly a: A
  }
  export const pure = <A>(a: A): Opts<A> => ({ _tag: 'Pure', a })
  export const unit: Opts<void> = pure(undefined)

  export interface Subcommand<A> {
    readonly _tag: 'Subcommand'
    readonly command: Command<A>
  }
  export const subcommand = <A>(command: Command<A>): Opts<A> => ({ _tag: 'Subcommand', command })

  export interface OrElse<A> {
    readonly _tag: 'OrElse'
    readonly a: Opts<A>
    readonly b: Lazy<Opts<A>>
  }
  export const orElse = <A>(b: Lazy<Opts<A>>) => (a: Opts<A>): Opts<A> => ({ _tag: 'OrElse', a, b })

  export const isPure = <A>(opts: Opts<A>): opts is Pure<A> => opts._tag === 'Pure'

  export const isSubcommand = <A>(opts: Opts<A>): opts is Subcommand<A> =>
    opts._tag === 'Subcommand'

  export const isOrElse = <A>(opts: Opts<A>): opts is OrElse<A> => opts._tag === 'OrElse'

  export const flatten = <A>(opts: Opts<A>): NonEmptyArray<Diff<Opts<A>, Opts.OrElse<A>>> =>
    isOrElse(opts)
      ? NonEmptyArray.concat(flatten(opts.a), flatten(opts.b()))
      : NonEmptyArray.of(opts)

  interface FoldArgs<A, B> {
    onPure: (a: A) => B
    onSubcommand: (command: Command<A>) => B
    onOrElse: (a: Opts<A>, b: Lazy<Opts<A>>) => B
  }
  export const fold = <A, B>({ onPure, onSubcommand, onOrElse }: FoldArgs<A, B>) => (
    opts: Opts<A>
  ): B => {
    switch (opts._tag) {
      case 'Pure':
        return onPure(opts.a)

      case 'Subcommand':
        return onSubcommand(opts.command)

      case 'OrElse':
        return onOrElse(opts.a, opts.b)
    }
  }
}
