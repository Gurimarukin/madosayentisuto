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
  export const map = <A, B>(f: (a: A) => B) => (cmd: Command<A>): Command<B> => ({
    name: cmd.name,
    opts: pipe(cmd.opts, Opts.map(f))
  })

  export const parse = (args: string[]) => <A>(cmd: Command<A>): Either<string, A> =>
    pipe(
      parseRec(cmd, args, []),
      Either.mapLeft(([, _]) => _)
    )

  export const help = <A>(context: NonEmptyArray<Command<A>>, message: string) => {
    const init = NonEmptyArray.init(context)
    const usages = pipe(
      siblingsOfLast(context),
      NonEmptyArray.map(cmd => {
        const res = List.snoc(init, cmd)
          .map(_ => _.name)
          .join(' ')
        return pipe(
          cmd.opts,
          Opts.fold({
            onPure: () => res,
            onOrElse: (_1, _2) => res,
            onArgument: (m, _) => `${res} <${m}>`,
            onSubcommand: _ => res
          })
        )
      })
    )
    return StringUtils.stripMargins(
      `${message}
      |Usage:
      |${usages.map(_ => `    ${_}`).join('\n')}`
    )
  }
}

const parseRec = <A>(
  cmd: Command<A>,
  args: string[],
  context: Command<A>[]
): Either<[number, string], A> => {
  const head = List.head(args)
  const newContext = List.snoc(context, cmd)
  return pipe(
    head,
    Either.fromOption<[number, string]>(() => [
      context.length,
      Command.help(newContext, missingCommand(newContext))
    ]),
    Either.filterOrElse<[number, string], string>(
      _ => _ === cmd.name,
      _ => [context.length, Command.help(newContext, `Unexpected argument: ${_}`)]
    ),
    Either.chain(_ => {
      const [, ...tail] = args
      return parseOpts(cmd.opts)

      function parseOpts(opts: Opts<A>): Either<[number, string], A> {
        return pipe(
          opts,
          Opts.fold({
            onPure: _ =>
              pipe(
                List.head(tail),
                Maybe.fold(
                  () => Either.right(_),
                  _ =>
                    Either.left([newContext.length, Command.help(newContext, 'To many arguments')])
                )
              ),
            onOrElse: (a, b) =>
              pipe(
                parseOpts(a),
                Either.orElse(ea =>
                  pipe(
                    parseOpts(b()),
                    Either.mapLeft(eb => (ea[0] >= eb[0] ? ea : eb))
                  )
                )
              ),
            onArgument: (m, d) =>
              pipe(
                List.head(tail),
                Maybe.fold(
                  () =>
                    Either.left([
                      newContext.length,
                      Command.help(newContext, `Missing expected argument: ${m}`)
                    ]),
                  _ =>
                    pipe(
                      d(_),
                      Either.mapLeft(_ => [newContext.length, _])
                    )
                )
              ),
            onSubcommand: _ => parseRec(_, tail, newContext)
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

const siblingsOfLast = <A>(context: NonEmptyArray<Command<A>>): NonEmptyArray<Command<A>> => {
  return pipe(
    context,
    NonEmptyArray.init,
    List.last,
    Maybe.fold(last, parentOfLast =>
      pipe(
        Opts.flatten(parentOfLast.opts),
        NonEmptyArray.chain(opt => {
          switch (opt._tag) {
            case 'Pure':
              return last()
            case 'Argument':
              return last()
            case 'Subcommand':
              return NonEmptyArray.of(opt.command)
          }
        })
      )
    )
  )

  function last(): NonEmptyArray<Command<A>> {
    return pipe(context, NonEmptyArray.last, NonEmptyArray.of)
  }
}
