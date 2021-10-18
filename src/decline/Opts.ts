import { Alt1 } from 'fp-ts/Alt'
import { Apply1 } from 'fp-ts/Apply'
import { Lazy } from 'fp-ts/function'
import { pipeable } from 'fp-ts/pipeable'

import { Command } from './Command'
import { ValidatedNea } from '../models/ValidatedNea'
import { Either, List, Maybe, NonEmptyArray, flow, pipe } from '../utils/fp'

declare module 'fp-ts/lib/HKT' {
  type URItoKind<A> = {
    readonly Opts: Opts<A>
  };
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
  /**
   * Opt
   */
  export type Opt<A> = Opt.Regular | Opt.Argument

  export namespace Opt {
    export type Regular = {
      readonly _tag: 'Regular'
      readonly names: ReadonlyArray<Name>
      readonly metavar: string
      readonly help: string
    };
    export const Regular = (names: ReadonlyArray<Name>, metavar: string, help: string): Opt<string> => ({
      _tag: 'Regular',
      names,
      metavar,
      help,
    })

    export type Argument = {
      readonly _tag: 'Argument'
      readonly metavar: string
    };
    export const Argument = (metavar: string): Opt<string> => ({ _tag: 'Argument', metavar })
  }

  /**
   * Opts
   */
  export const opts: Apply1<URI> & Alt1<URI> = {
    URI,
    map: <A, B>(fa: Opts<A>, f: (a: A) => B): Opts<B> => mapValidated(flow(f, Either.right))(fa),
    ap: <A, B>(fab: Opts<(a: A) => B>, fa: Opts<A>): Opts<B> => App(fab, fa),
    alt: <A>(fx: Opts<A>, fy: () => Opts<A>): Opts<A> => OrElse(fx, fy()),
  }

  /**
   * methods
   */
  export function mapValidated<A, B>(
    f: (a: A) => ValidatedNea<string, B>,
  ): (opts: Opts<A>) => Opts<B> {
    return opts =>
      opts._tag === 'Validate'
        ? Validate(opts.value, flow(opts.validate, Either.chain(f)))
        : Validate(opts, f)
  }

  export const { map, ap, alt } = pipeable(opts)

  export const withDefault = <A>(fy: Lazy<A>) => (opts: Opts<A>): Opts<A> =>
    pipe(
      opts,
      alt(() => Opts.pure(fy())),
    )

  export const orNone = <A>(opts: Opts<A>): Opts<Maybe<A>> =>
    pipe(
      opts,
      map(Maybe.some),
      withDefault<Maybe<A>>(() => Maybe.none),
    )

  export const orEmpty = <A>(opts: Opts<NonEmptyArray<A>>): Opts<ReadonlyArray<A>> =>
    pipe(
      opts,
      withDefault<ReadonlyArray<A>>(() => []),
    )

  /**
   * subtypes
   */
  export type Pure<A> = {
    readonly _tag: 'Pure'
    readonly a: A
  };
  export const Pure = <A>(a: A): Pure<A> => ({ _tag: 'Pure', a })

  export type App<A, B> = {
    readonly _tag: 'App'
    readonly f: Opts<(a: A) => B>
    readonly a: Opts<A>
  };
  export function App<A, B>(f: Opts<(a: A) => B>, a: Opts<A>): Opts<B> {
    return { _tag: 'App', f, a } as Opts<B>
  }

  export type OrElse<A> = {
    readonly _tag: 'OrElse'
    readonly a: Opts<A>
    readonly b: Opts<A>
  };
  export function OrElse<A>(a: Opts<A>, b: Opts<A>): Opts<A> {
    return { _tag: 'OrElse', a, b }
  }

  export type Single<A> = {
    readonly _tag: 'Single'
    readonly opt: Opt<A>
  };
  export const Single = <A>(opt: Opt<A>): Single<A> => ({ _tag: 'Single', opt })

  export type Repeated<A> = {
    readonly _tag: 'Repeated'
    readonly opt: Opt<A>
  };
  export const Repeated = <A>(opt: Opt<A>): Opts<NonEmptyArray<A>> => ({ _tag: 'Repeated', opt })

  export type Subcommand<A> = {
    readonly _tag: 'Subcommand'
    readonly command: Command<A>
  };
  export const Subcommand = <A>(command: Command<A>): Subcommand<A> => ({
    _tag: 'Subcommand',
    command,
  })

  export type Validate<A, B> = {
    readonly _tag: 'Validate'
    readonly value: Opts<A>
    readonly validate: (a: A) => ValidatedNea<string, B>
  };
  export function Validate<A, B>(
    value: Opts<A>,
    validate: (a: A) => ValidatedNea<string, B>,
  ): Opts<B> {
    return { _tag: 'Validate', value, validate } as Opts<B>
  }

  /**
   * helpers
   */
  export const unit: Opts<void> = Pure(undefined)

  export const pure = <A>(a: A): Opts<A> => Pure(a)

  export const option = <A>(codec: (raw: string) => ValidatedNea<string, A>) => ({
    long,
    help,
    short = '',
    metavar,
  }: OptionArgs): Opts<A> =>
    pipe(Single(Opt.Regular(namesFor(long, short), metavar, help)), mapValidated(codec))

  export const options = <A>(codec: (raw: string) => ValidatedNea<string, A>) => ({
    long,
    help,
    short = '',
    metavar,
  }: OptionArgs): Opts<NonEmptyArray<A>> =>
    pipe(
      Repeated<string>(Opt.Regular(namesFor(long, short), metavar, help)),
      mapValidated(args =>
        NonEmptyArray.nonEmptyArray.traverse(
          Either.getValidation(NonEmptyArray.getSemigroup<string>()),
        )(args, codec),
      ),
    )

  // export const flag = (long: string): Opts<void> => ???
  // export const flags = (long: string): Opts<number> => ???

  export const param = <A>(codec: (raw: string) => ValidatedNea<string, A>) => (
    metavar: string,
  ): Opts<A> => pipe(Single(Opt.Argument(metavar)), mapValidated(codec))

  export const params = <A>(codec: (raw: string) => ValidatedNea<string, A>) => (
    metavar: string,
  ): Opts<NonEmptyArray<A>> =>
    pipe(
      Repeated<string>(Opt.Argument(metavar)),
      mapValidated(args =>
        NonEmptyArray.nonEmptyArray.traverse(
          Either.getValidation(NonEmptyArray.getSemigroup<string>()),
        )(args, codec),
      ),
    )

  export const subcommand = <A>(command: Command<A>): Opts<A> => Subcommand(command)

  /**
   * Name
   */
  export type Name = Name.LongName | Name.ShortName

  export namespace Name {
    export type LongName = {
      readonly _tag: 'LongName'
      readonly flag: string
    };
    export const LongName = (flag: string): LongName => ({ _tag: 'LongName', flag })

    export type ShortName = {
      readonly _tag: 'ShortName'
      readonly flag: string
    };
    export const ShortName = (flag: string): ShortName => ({ _tag: 'ShortName', flag })

    export const stringify = (name: Name): string =>
      name._tag === 'LongName' ? `--${name.flag}` : `-${name.flag}`
  }

  function namesFor(long: string, short: string): ReadonlyArray<Name> {
    return List.cons<Name>(Name.LongName(long), short.split('').map(Name.ShortName))
  }
}

type OptionArgs = {
  readonly long: string
  readonly help: string
  readonly short?: string
  readonly metavar: string
};
