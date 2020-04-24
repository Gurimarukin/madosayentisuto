import { Opts } from './Opts'
import { Either, List, pipe, Maybe, NonEmptyArray } from '../utils/fp'
import { StringUtils } from '../utils/StringUtils'

export interface Command<A> {
  readonly name: string
  readonly opts: Opts<A>
}

export function Command(name: string): <A>(opts: Opts<A>) => Command<A> {
  return opts => ({ name, opts })
}

export namespace Command {
  export const parse = (args: string[]) => <A>(cmd: Command<A>): Either<string, A> =>
    parseRec(args, cmd, Maybe.none, [])

  export const help = <A>(
    cmd: Command<A>,
    parent: Maybe<Opts<A>>,
    acc: string[],
    message: string
  ) => {
    const usages = pipe(
      parent,
      Maybe.chain(subcommands),
      Maybe.fold(
        () => `    ${[...acc, cmd.name].join(' ')}`,
        _ => _.map(_ => `    ${[...acc, _.command.name].join(' ')}`).join('\n')
      )
    )
    return StringUtils.stripMargins(
      `${message}
      |Usage:
      |${usages}`
    )
  }
}

const parseRec = <A>(
  args: string[],
  cmd: Command<A>,
  parent: Maybe<Opts<A>>,
  acc: string[]
): Either<string, A> => {
  const head = List.head(args)

  return pipe(
    head,
    Either.fromOption(() => Command.help(cmd, parent, acc, missingCommand(cmd, parent))),
    Either.filterOrElse(
      _ => _ === cmd.name,
      _ => Command.help(cmd, parent, acc, `Unknown command ${_}`)
    ),
    Either.chain(_ => {
      const [, ...tail] = args
      return parseOpts(tail, cmd.opts, cmd, parent, List.snoc(acc, cmd.name))
    })
  )
}

const missingCommand = <A>(cmd: Command<A>, parent: Maybe<Opts<A>>): string => {
  const names = pipe(
    parent,
    Maybe.filter(Opts.isOrElse),
    Maybe.fold(
      () => [cmd.name],
      _ => {
        const subs = subcommands(_)
        return pipe(
          subs,
          Maybe.fold(
            () => [cmd.name],
            _ => _.map(_ => _.command.name)
          )
        )
      }
    )
  )
  return `Missing expected command (${names.join(' or ')})`
}

const parseOpts = <A>(
  args: string[],
  opts: Opts<A>,
  cmd: Command<A>,
  parent: Maybe<Opts<A>>,
  acc: string[]
): Either<string, A> => {
  switch (opts._tag) {
    case 'Pure':
      const head = List.head(args)
      return Maybe.isNone(head)
        ? Either.right(opts.a)
        : Either.left(Command.help(cmd, parent, acc, `To many arguments`))

    case 'Subcommand':
      return parseRec(args, opts.command, parent, acc)

    case 'OrElse':
      return pipe(
        parseOpts(args, opts.a, cmd, Maybe.some(opts), acc),
        Either.orElse(_ => parseOpts(args, opts.b(), cmd, Maybe.some(opts), acc))
      )
  }
}

const subcommands = <A>(opts: Opts<A>): Maybe<NonEmptyArray<Opts.Subcommand<A>>> =>
  Opts.isSubcommand(opts)
    ? Maybe.some(NonEmptyArray.of(opts))
    : Opts.isOrElse(opts)
    ? subcommandsFromOrElse(opts)
    : Maybe.none

const subcommandsFromOrElse = <A>(
  opts: Opts.OrElse<A>
): Maybe<NonEmptyArray<Opts.Subcommand<A>>> => {
  const a = Maybe.getOrElse<Opts.Subcommand<A>[]>(() => [])(subcommands(opts.a))
  const b = Maybe.getOrElse<Opts.Subcommand<A>[]>(() => [])(subcommands(opts.b()))
  return NonEmptyArray.fromArray([...a, ...b])
}
