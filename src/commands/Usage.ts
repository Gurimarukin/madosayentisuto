import { flow } from 'fp-ts/lib/function'

import { Opts } from './Opts'
import { List, Do, pipe, Maybe } from '../utils/fp'
import { StringUtils } from '../utils/StringUtils'

/**
 * Many
 */
type Many<A> = Many.Just<A> | Many.Prod<A> | Many.Sum<A>

namespace Many {
  /**
   * Methods
   */
  export const asProd = <A>(many: Many<A>): Many.Prod<A> => Many.Prod(many)
  export const asSum = <A>(many: Many<A>): Many.Sum<A> => Many.Sum(many)

  /**
   * Just
   */
  export interface Just<A> {
    readonly _tag: 'Just'
    readonly value: A
  }

  export function Just<A>(value: A): Just<A> {
    return { _tag: 'Just', value }
  }

  export const isJust = <A>(many: Many<A>): many is Just<A> => many._tag === 'Just'

  /**
   * Prod
   */
  export interface Prod<A> {
    readonly _tag: 'Prod'
    readonly allOf: Many<A>[]
  }

  export function Prod<A>(...allOf: Many<A>[]): Prod<A> {
    return { _tag: 'Prod', allOf }
  }

  export namespace Prod {
    export const and = <A>(other: Prod<A>) => (prod: Prod<A>): Prod<A> =>
      Prod(...List.concat(prod.allOf, other.allOf))
  }

  export const isProd = <A>(many: Many<A>): many is Prod<A> => many._tag === 'Prod'

  /**
   * Sum
   */
  export interface Sum<A> {
    readonly _tag: 'Sum'
    readonly anyOf: Many<A>[]
  }

  export function Sum<A>(...anyOf: Many<A>[]): Sum<A> {
    return { _tag: 'Sum', anyOf }
  }

  export namespace Sum {
    export const or = <A>(other: Sum<A>) => (sum: Sum<A>): Sum<A> =>
      Sum(...List.concat(sum.anyOf, other.anyOf))
  }
}

/**
 * Options
 */
type Options = Options.Required | Options.Repeated

namespace Options {
  export interface Required {
    readonly _tag: 'Required'
    readonly text: string
  }

  export const isRequired = (opts: Options): opts is Required => opts._tag === 'Required'

  export interface Repeated {
    readonly _tag: 'Repeated'
    readonly text: string
  }

  export const isRepeated = (opts: Options): opts is Repeated => opts._tag === 'Repeated'
}

/**
 * Args
 */
type Args = Args.Required | Args.Repeated | Args.Command

namespace Args {
  /**
   * Required
   */
  export interface Required {
    readonly _tag: 'Required'
    readonly metavar: string
  }

  export const Required = (metavar: string): Required => ({ _tag: 'Required', metavar })

  /**
   * Repeated
   */
  export interface Repeated {
    readonly _tag: 'Repeated'
    readonly metavar: string
  }

  export const Repeated = (metavar: string): Repeated => ({ _tag: 'Repeated', metavar })

  /**
   * Command
   */
  export interface Command {
    readonly _tag: 'Command'
    readonly name: string
  }

  export const Command = (name: string): Command => ({ _tag: 'Command', name })
}

/**
 * Usage
 */
export interface Usage {
  readonly opts: Many<Options>
  readonly args: Many<Args>
}

export function Usage({ opts = Many.Prod(), args = Many.Prod() }: Partial<Usage> = {}): Usage {
  return { opts, args }
}

export namespace Usage {
  const asProd = Many.asProd
  const asSum = Many.asSum
  const and = Many.Prod.and
  const or = Many.Sum.or

  /**
   * methods
   */

  export const show = (usage: Usage): string[] =>
    Do(List.array)
      .bind('opt', showOptions(usage.opts))
      .bind('arg', showArgs(usage.args))
      .return(({ opt, arg }) => concat([opt, arg]))

  /**
   * helpers
   */
  export const fromOpts = (opts: Opts<unknown>): Usage[] => {
    switch (opts._tag) {
      case 'Pure':
        return List.of(Usage())

      case 'App':
        return Do(List.array)
          .bind('l', fromOpts(opts.f))
          .bind('r', fromOpts(opts.a))
          .return(({ l, r }) =>
            Usage({
              opts: pipe(asProd(l.opts), and(asProd(r.opts))),
              args: pipe(asProd(l.args), and(asProd(r.args)))
            })
          )

      case 'OrElse':
        const left = pipe(fromOpts(opts.a), List.reverse)
        const right = fromOpts(opts.b)

        if (List.isEmpty(left) && List.isEmpty(right)) return List.empty

        const [l, ...ls] = left
        const [r, ...rs] = right

        if (isEmptyProd(l.args) && isEmptyProd(r.args)) {
          return pipe(
            List.reverse(ls),
            _ => List.snoc(_, Usage({ opts: pipe(asSum(l.opts), or(asSum(r.opts))) })),
            _ => List.concat(_, rs)
          )
        }

        if (isEmptyProd(l.opts) && isEmptyProd(r.opts)) {
          return pipe(
            List.reverse(ls),
            _ => List.snoc(_, Usage({ args: pipe(asSum(l.args), or(asSum(r.args))) })),
            _ => List.concat(_, rs)
          )
        }

        return List.concat(List.reverse(ls), rs)

      case 'Single':
        return single(opts.opt)

      case 'Repeated':
        return repeated(opts.opt)

      case 'Subcommand':
        return List.of(Usage({ args: Many.Just(Args.Command(opts.command.name)) }))

      case 'Validate':
        return fromOpts(opts.value)
    }
  }

  const single = (opt: Opts.Opt<unknown>): Usage[] => {
    switch (opt._tag) {
      case 'Argument':
        return List.of(Usage({ args: Many.Just(Args.Required(`<${opt.metavar}>`)) }))
    }
  }

  const repeated = (opt: Opts.Opt<unknown>): Usage[] => {
    switch (opt._tag) {
      case 'Argument':
        return List.of(Usage({ args: Many.Just(Args.Repeated(`<${opt.metavar}>`)) }))
    }
  }
}

const isEmptyProd = <A>(many: Many<A>): many is Many.Prod<A> =>
  Many.isProd(many) && List.isEmpty(many.allOf)

const concat = (all: string[]): string => all.filter(_ => _ !== '').join(' ')

const asOptional = <A>(list: Many<A>[]): Maybe<Many<A>[]> => {
  if (List.isEmpty(list)) return Maybe.none
  const [head, ...tail] = list
  return isEmptyProd(head)
    ? Maybe.some(tail.filter(_ => !isEmptyProd(_)))
    : pipe(
        asOptional(tail),
        Maybe.map(_ => List.cons(head, _))
      )
}

const showOptions = (opts: Many<Options>): string[] => {
  switch (opts._tag) {
    case 'Sum':
      return pipe(
        asOptional(opts.anyOf),
        Maybe.fold(
          () => pipe(opts.anyOf, List.chain(showOptions)),
          l =>
            // l matches List.of(Many.Just(Options.Repeated(_)))
            l.length === 1 && Many.isJust(l[0]) && Options.isRepeated(l[0].value)
              ? List.of(`[${l[0].value.text}...`)
              : l.map(flow(showOptions, StringUtils.mkString('[', ' | ', ']'))) // decline uses traverse ¯\_(ツ)_/¯
        )
      )

    case 'Just':
      const option = opts.value
      switch (option._tag) {
        case 'Required':
          return List.of(option.text)
        case 'Repeated':
          return List.of(`${option.text} [${option.text}]...`)
      }

    case 'Prod':
      return opts.allOf.map(flow(showOptions, concat)) // decline uses traverse ¯\_(ツ)_/¯
  }
}

const showArgs = (args: Many<Args>): string[] => {
  switch (args._tag) {
    case 'Sum':
      if (List.isEmpty(args.anyOf)) return List.empty
      if (args.anyOf.length === 1) return showArgs(args.anyOf[0])
      return pipe(
        asOptional(args.anyOf),
        Maybe.fold(
          () => pipe(args.anyOf, List.chain(showArgs)),
          List.map(flow(showArgs, StringUtils.mkString('[', ' | ', ']'))) // decline uses traverse ¯\_(ツ)_/¯
        )
      )

    case 'Prod':
      if (args.allOf.length === 1) return showArgs(args.allOf[0])
      return args.allOf.map(flow(showArgs, concat))

    case 'Just':
      const arg = args.value
      switch (arg._tag) {
        case 'Required':
          return List.of(arg.metavar)
        case 'Repeated':
          return List.of(`${arg.metavar}...`)
        case 'Command':
          return List.of(arg.name)
      }
  }
}
