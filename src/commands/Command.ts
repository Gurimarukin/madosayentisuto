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
      parseRec(cmd, args, Either.left(cmd)),
      Either.mapLeft(([, _]) => _)
    )
}

type Context<A> = Either<Command<A>, NonEmptyArray<Opts<A>>>

const parseRec = <A>(
  cmd: Command<A>,
  args: string[],
  context: Context<A>
): Either<[number, string], A> => {
  const head = List.head(args)
  return pipe(
    head,
    Either.fromOption<[number, string]>(() => [
      getDepth(context),
      help(context, missingCommand(context))
    ]),
    Either.filterOrElse<[number, string], string>(
      _ => _ === cmd.name,
      _ => [getDepth(context), help(context, `Unexpected argument: ${_}`)]
    ),
    Either.chain(_ => {
      const [, ...tail] = args
      return parseOpts(cmd.opts, tail, pipe(context, addToContext(Opts.subcommand(cmd))))
    })
  )
}

const parseOpts = <A>(
  opt: Opts<A>,
  args: string[],
  context: Context<A>
): Either<[number, string], A> =>
  pipe(
    opt,
    Opts.fold({
      onPure: _ =>
        pipe(
          List.head(args),
          Maybe.fold(
            () => Either.right(_),
            _ => {
              const newContext = pipe(context, addToContext(opt))
              return Either.left([getDepth(newContext), help(newContext, 'To many arguments')])
            }
          )
        ),
      onOrElse: (a, b) =>
        pipe(
          parseOpts(a, args, context),
          Either.orElse(ea =>
            pipe(
              parseOpts(b(), args, context),
              Either.mapLeft(eb => (ea[0] >= eb[0] ? ea : eb))
            )
          )
        ),
      onArgument: (m, d) =>
        pipe(
          List.head(args),
          Maybe.fold<string, Either<[number, string], A>>(
            () =>
              Either.left([getDepth(context), help(context, `Missing expected argument: <${m}>`)]),
            _ =>
              pipe(
                d(_),
                Either.mapLeft<string, [number, string]>(_ => [
                  getDepth(context),
                  help(context, _)
                ]),
                Either.filterOrElse<[number, string], A>(
                  _ => args.length === 1,
                  _ => [getDepth(context), help(context, 'To many arguments')]
                )
              )
          )
        ),
      onSubcommand: _ => parseRec(_, args, context)
    })
  )

const getDepth = <A>(context: Context<A>): number =>
  pipe(
    context,
    Either.fold(
      _ => 0,
      _ => _.length
    )
  )

const addToContext = <A>(cmd: Opts<A>) => (context: Context<A>): Context<A> =>
  pipe(
    context,
    Either.fold(
      _ => Either.right(NonEmptyArray.of(cmd)),
      _ => Either.right(List.snoc(_, cmd))
    )
  )

const missingCommand = <A>(context: Context<A>): string => {
  const res = pipe(
    childrenOfLast(context),
    Maybe.chain(_ => pipe(_, List.filter(Opts.isSubcommand), NonEmptyArray.fromArray)),
    Maybe.fold(
      () => '',
      _ => ` (${_.map(_ => _.command.name).join(' or ')})`
    )
  )
  return `Missing expected command${res}`
}

const help = <A>(context: Context<A>, message: string): string =>
  StringUtils.stripMargins(
    `${message}
    |Usage:
    |${getUsages(context)
      .map(_ => `    ${_}`)
      .join('\n')}`
  )

const getUsages = <A>(context: Context<A>): NonEmptyArray<string> =>
  pipe(
    context,
    Either.fold(
      cmd => NonEmptyArray.of(cmd.name),
      opts => {
        const res = pipe(opts, List.filterMap(Opts.toString), _ => _.join(' '), NonEmptyArray.of)
        return pipe(
          childrenOfLast(context),
          Maybe.fold(
            () => res,
            opts =>
              pipe(
                opts,
                NonEmptyArray.map(opt => {
                  const optStr =
                    Opts.isSubcommand(opt) && Opts.isArgument(opt.command.opts)
                      ? pipe(
                          [opt, opt.command.opts],
                          List.filterMap(Opts.toString),
                          NonEmptyArray.fromArray,
                          Maybe.map(_ => _.join(' '))
                        )
                      : Opts.toString(opt)

                  return [res, Maybe.toArray(optStr)].join(' ')
                })
              )
          )
        )
      }
    )
  )

const childrenOfLast = <A>(context: Context<A>): Maybe<NonEmptyArray<Opts<A>>> =>
  pipe(
    context,
    Either.fold(
      cmd => Maybe.some(NonEmptyArray.of(Opts.subcommand(cmd))),
      opts =>
        pipe(
          opts,
          NonEmptyArray.last,
          Maybe.some,
          Maybe.chain(opt =>
            Opts.isSubcommand(opt)
              ? Maybe.some(Opts.flatten(opt.command.opts))
              : Opts.isArgument(opt)
              ? Maybe.some(NonEmptyArray.of(opt))
              : Maybe.none
          )
        )
    )
  )
