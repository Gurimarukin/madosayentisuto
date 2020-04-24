import { Lazy } from 'fp-ts/lib/function'

import { Command } from './Command'

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
}
