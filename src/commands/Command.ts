import { Lazy } from 'fp-ts/lib/function'

import { CommandWithPrefix } from './CommandWithPrefix'
import { Context } from './Context'
import { Opts } from './Opts'
import { Validated } from './Validated'
import { Either, List, pipe, Maybe } from '../utils/fp'
import { StringUtils } from '../utils/StringUtils'

export interface Command<A> {
  readonly name: string
  readonly opts: Opts<A>
}

export function Command(name: string): <A>(opts: Opts<A>) => Command<A> {
  return opts => ({ name, opts })
}

export namespace Command {
  export const map = <A, B>(f: (a: A) => B) => (cmd: Command<A>): Command<B> => ({
    name: cmd.name,
    opts: pipe(cmd.opts, Opts.map(f))
  })

  export const parse = (args: string[]) => <A>(cmd: CommandWithPrefix<A>): Validated<A> =>
    parseOpts(cmd.opts, args, Context(cmd.prefix, [], Opts.flatten(cmd.opts)))
}

const parseOpts = <A>(opts: Opts<A>, args: string[], context: Context<A>): Validated<A> => {
  const onPure = (a: A): Validated<A> =>
    pipe(
      List.head(args),
      Maybe.fold(
        () => Either.right(a),
        _ => Either.left(help('To many arguments', context))
      )
    )

  const onOrElse = (a: Opts<A>, b: Lazy<Opts<A>>): Validated<A> =>
    pipe(
      parseOpts(a, args, context),
      Either.orElse(_ => parseOpts(b(), args, context))
    )

  const onArgument = (metavar: string, decode: (raw: string) => Validated<A>): Validated<A> =>
    pipe(
      List.head(args),
      Maybe.fold(
        () => Either.left(help(`Missing expected argument: <${metavar}>`, context)),
        _ =>
          pipe(
            decode(_),
            Either.mapLeft(_ => help(_, context)),
            Either.filterOrElse(
              _ => args.length === 1,
              _ => help('To many arguments', context)
            )
          )
      )
    )

  const onSubcommand = (cmd: Command<A>): Validated<A> => parseCmd(cmd, args, context)

  return pipe(opts, Opts.fold({ onPure, onOrElse, onArgument, onSubcommand }))
}

const parseCmd = <A>(cmd: Command<A>, args: string[], context: Context<A>): Validated<A> => {
  const head = List.head(args)
  return pipe(
    head,
    Either.fromOption(() => {
      const siblings = pipe(context.siblings, List.filterMap(Opts.toString))
      return help(`Missing expected command (${siblings.join(' or ')})`, context)
    }),
    Either.filterOrElse(
      _ => _ === cmd.name,
      _ => help(`Unexpected argument: ${_}`, context)
    ),
    Either.chain(_ => {
      const [, ...tail] = args
      const newContext = pipe(
        context,
        Context.setParents(List.snoc(context.parents, cmd)),
        Context.setSiblings(Opts.flatten(cmd.opts))
      )
      return parseOpts(cmd.opts, tail, newContext)
    })
  )
}

const help = <A>(message: string, context: Context<A>): string => {
  const parents = context.parents.map(_ => Maybe.some(_.name))
  const siblings = pipe(
    context.siblings,
    List.filterMap(opts =>
      pipe(
        Opts.toString(opts),
        Maybe.map(_ => {
          const argument =
            Opts.isSubcommand(opts) && Opts.isArgument(opts.command.opts)
              ? Opts.toString(opts.command.opts)
              : Maybe.none
          const res = List.compact([
            Maybe.some(context.prefix),
            ...parents,
            Maybe.some(_),
            argument
          ])
          return `    ${res.join(' ')}`
        })
      )
    )
  )
  return StringUtils.stripMargins(
    `${message}
    |Usage:
    |${siblings.join('\n')}`
  )
}
