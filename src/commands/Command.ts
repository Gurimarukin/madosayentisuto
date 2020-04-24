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
    parseRec(cmd, args, [])

  export const help = <A>(context: NonEmptyArray<Command<A>>, message: string) => {
    const init = NonEmptyArray.init(context)
    const usages = pipe(
      siblingsOfLast(context),
      NonEmptyArray.map(cmd => {
        const res = List.snoc(init, cmd)
          .map(_ => _.name)
          .join(' ')
        return `    ${res}`
      })
    )
    return StringUtils.stripMargins(
      `${message}
      |Usage:
      |${usages.join('\n')}`
    )
  }
}

const parseRec = <A>(cmd: Command<A>, args: string[], context: Command<A>[]): Either<string, A> => {
  const head = List.head(args)
  const newContext = List.snoc(context, cmd)
  return pipe(
    head,
    Either.fromOption(() => Command.help(newContext, missingCommand(newContext))),
    Either.filterOrElse(
      _ => _ === cmd.name,
      _ => Command.help(newContext, `Unexpected argument: ${_}`)
    ),
    Either.chain(_ => {
      const [, ...tail] = args
      return parseOpts(cmd.opts)

      function parseOpts(opts: Opts<A>): Either<string, A> {
        return pipe(
          opts,
          Opts.fold({
            onPure: _ =>
              pipe(
                List.head(tail),
                Maybe.fold(
                  () => Either.right(_),
                  _ => Either.left('To many arguments')
                )
              ),
            onSubcommand: _ => parseRec(_, tail, newContext),
            onOrElse: (a, b) =>
              pipe(
                parseOpts(a),
                Either.orElse(_ => parseOpts(b()))
              )
          })
        )
      }
    })
  )
}

const missingCommand = <A>(context: NonEmptyArray<Command<A>>): string =>
  `Missing expected command (${siblingsOfLast(context)
    .map(_ => _.name)
    .join(' or ')})`

const siblingsOfLast = <A>(context: NonEmptyArray<Command<A>>): NonEmptyArray<Command<A>> =>
  pipe(
    context,
    NonEmptyArray.init,
    List.last,
    Maybe.fold(
      () => pipe(context, NonEmptyArray.last, NonEmptyArray.of),
      parentOfLast =>
        pipe(
          Opts.flatten(parentOfLast.opts),
          NonEmptyArray.chain(opt => {
            switch (opt._tag) {
              case 'Pure':
                return pipe(context, NonEmptyArray.last, NonEmptyArray.of)
              case 'Subcommand':
                return NonEmptyArray.of(opt.command)
            }
          })
        )
    )
  )
