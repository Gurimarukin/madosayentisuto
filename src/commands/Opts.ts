import { Alt1 } from 'fp-ts/lib/Alt'
import { Apply1 } from 'fp-ts/lib/Apply'
import { pipeable } from 'fp-ts/lib/pipeable'

import { Command } from './Command'
import { ValidatedNea } from '../models/ValidatedNea'
import { NonEmptyArray, Either, flow, pipe } from '../utils/fp'

declare module 'fp-ts/lib/HKT' {
  interface URItoKind<A> {
    readonly Opts: Opts<A>
  }
}

export const URI = 'Opts'
export type URI = typeof URI

export type Opts<A> =
  | Opts.Pure<A>
  | Opts.App<unknown, A>
  | Opts.OrElse<A>
  | Opts.Single<A>
  | Opts.Repeated<A>
  | Opts.Subcommand<A>
  | Opts.Validate<unknown, A>

export namespace Opts {
  export const opts: Apply1<URI> & Alt1<URI> = {
    URI,
    map: <A, B>(fa: Opts<A>, f: (a: A) => B): Opts<B> => mapValidated(flow(f, Either.right))(fa),
    ap: <A, B>(fab: Opts<(a: A) => B>, fa: Opts<A>): Opts<B> => App(fab, fa),
    alt: <A>(fx: Opts<A>, fy: () => Opts<A>): Opts<A> => OrElse(fx, fy())
  }

  /**
   * methods
   */
  export const mapValidated = <A, B>(f: (a: A) => ValidatedNea<string, B>) => (
    opts: Opts<A>
  ): Opts<B> => {
    switch (opts._tag) {
      case 'Validate':
        return Validate(opts.value, flow(opts.validate, Either.chain(f)))

      default:
        return Validate(opts, f)
    }
  }

  export const { map, ap, alt } = pipeable(opts)

  /**
   * subtypes
   */
  export interface Pure<A> {
    readonly _tag: 'Pure'
    readonly a: A
  }
  export const Pure = <A>(a: A): Pure<A> => ({ _tag: 'Pure', a })

  export interface App<A, B> {
    readonly _tag: 'App'
    readonly f: Opts<(a: A) => B>
    readonly a: Opts<A>
  }
  export const App = <A, B>(f: Opts<(a: A) => B>, a: Opts<A>): Opts<B> =>
    ({ _tag: 'App', f, a } as Opts<B>)

  export interface OrElse<A> {
    readonly _tag: 'OrElse'
    readonly a: Opts<A>
    readonly b: Opts<A>
  }
  export const OrElse = <A>(a: Opts<A>, b: Opts<A>): Opts<A> => ({ _tag: 'OrElse', a, b })

  export interface Single<A> {
    readonly _tag: 'Single'
    readonly opt: Opt<A>
  }
  export const Single = <A>(opt: Opt<A>): Single<A> => ({ _tag: 'Single', opt })

  export interface Repeated<A> {
    readonly _tag: 'Repeated'
    readonly opt: Opt<A>
  }
  export const Repeated = <A>(opt: Opt<A>): Opts<NonEmptyArray<A>> => ({ _tag: 'Repeated', opt })

  export interface Subcommand<A> {
    readonly _tag: 'Subcommand'
    readonly command: Command<A>
  }
  export const Subcommand = <A>(command: Command<A>): Subcommand<A> => ({
    _tag: 'Subcommand',
    command
  })

  export interface Validate<A, B> {
    readonly _tag: 'Validate'
    readonly value: Opts<A>
    readonly validate: (a: A) => ValidatedNea<string, B>
  }
  export const Validate = <A, B>(
    value: Opts<A>,
    validate: (a: A) => ValidatedNea<string, B>
  ): Opts<B> => ({ _tag: 'Validate', value, validate } as Opts<B>)

  /**
   * helpers
   */

  export const unit: Opts<void> = Pure(undefined)

  export const pure = <A>(a: A): Opts<A> => Pure(a)

  // export const option = <A>(long: string): Opts<A> => ???
  // export const options = <A>(long: string): Opts<NonEmptyArray<A>> => ???

  // export const flag = (long: string): Opts<void> => ???
  // export const flags = (long: string): Opts<number> => ???

  export const param = <A>(
    metavar: string,
    codec: (raw: string) => ValidatedNea<string, A>
  ): Opts<A> => pipe(Single(Opt.Argument(metavar)), mapValidated(codec))

  export const params = <A>(
    metavar: string,
    codec: (raw: string) => ValidatedNea<string, A>
  ): Opts<NonEmptyArray<A>> =>
    pipe(
      Repeated<string>(Opt.Argument(metavar)),
      mapValidated(args =>
        NonEmptyArray.nonEmptyArray.traverse(
          Either.getValidation(NonEmptyArray.getSemigroup<string>())
        )(args, codec)
      )
    )

  export const subcommand = <A>(command: Command<A>): Opts<A> => Subcommand(command)

  /**
   * Opt
   */
  export type Opt<A> = Opt.Argument

  export namespace Opt {
    export interface Argument {
      readonly _tag: 'Argument'
      readonly metavar: string
    }
    export const Argument = (metavar: string): Opt<string> => ({ _tag: 'Argument', metavar })
  }
}
