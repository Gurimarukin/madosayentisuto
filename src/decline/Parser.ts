import { eqString } from 'fp-ts/lib/Eq'

import { Accumulator, ArgOut } from './Accumulator'
import { Command } from './Command'
import { Help } from './Help'
import { Opts } from './Opts'
import { Result } from './Result'
import { Either, pipe, NonEmptyArray, Maybe, List, flow } from '../utils/fp'
import { StringUtils } from '../utils/StringUtils'

export const longOpt: (str: string) => Maybe<string> = StringUtils.matcher1(/--(.+)/)
export const longOptWithEquals: (str: string) => Maybe<[string, string]> = StringUtils.matcher2(
  /--(.+?)=(.+)/,
)
export const shortOpt: (str: string) => Maybe<[string, string]> = flow(
  StringUtils.matcher1(/-(.+)/),
  Maybe.chain(nonEmptyString),
)

function nonEmptyString(str: string): Maybe<[string, string]> {
  return StringUtils.isEmpty(str) ? Maybe.none : Maybe.some([str[0], str.substring(1)])
}

export type Parser<A> = (args: string[]) => Either<Help, A>

export const Parser = <A>(command: Command<A>): Parser<A> => {
  const help = Help.fromCommand(command)

  return args => consumeAll(args, Accumulator.fromOpts(command.opts))

  function failure<A>(...reasons: string[]): Either<Help, A> {
    return Either.left(pipe(help, Help.withErrors(reasons)))
  }

  function evalResult<A>(out: Result<A>): Either<Help, A> {
    return pipe(
      out.get,
      Either.fold(
        failed => failure(...pipe(failed, Result.Failure.messages, List.uniq(eqString))),
        // NB: if any of the user-provided functions have side-effects, they will happen here!
        fn =>
          pipe(
            fn(),
            Either.fold(
              messages => failure(...pipe(messages, List.uniq(eqString))),
              result => Either.right(result),
            ),
          ),
      ),
    )
  }

  function toOption<B>(args: ArgOut<B>): Maybe<Accumulator<B>> {
    return pipe(
      args,
      List.filterMap(Maybe.fromEither),
      NonEmptyArray.fromArray,
      Maybe.map(([head, ...tail]) => pipe(tail, List.reduce(head, Accumulator.OrElse))),
    )
  }

  function consumeAll(args: string[], accumulator: Accumulator<A>): Either<Help, A> {
    if (List.isEmpty(args)) return evalResult(accumulator.result)

    const [arg, ...tail] = args

    return pipe(
      pipe(longOptWithEquals(arg), Maybe.map(consumeLongOptWithEquals(tail, accumulator))),
      Maybe.alt(() => pipe(longOpt(arg), Maybe.map(consumeLongOpt(tail, accumulator)))),
      Maybe.alt(() => (arg === '--' ? Maybe.some(consumeArgs(tail, accumulator)) : Maybe.none)),
      Maybe.alt(() => pipe(shortOpt(arg), Maybe.map(consumeShortOpt(tail, accumulator)))),
      Maybe.getOrElse(() => consumeDefault(arg, tail, accumulator)),
    )
  }

  function consumeLongOptWithEquals(
    tail: string[],
    accumulator: Accumulator<A>,
  ): (match: [string, string]) => Either<Help, A> {
    return ([option, value]) =>
      pipe(
        accumulator.parseOption(Opts.Name.LongName(option)),
        Maybe.fold(
          () => Either.left(pipe(help, Help.withErrors(List.of(`Unexpected option: --${option}`)))),
          Accumulator.Match.fold({
            onFlag: _ => failure(`Got unexpected value for flag: --${option}`),
            onOption: next => consumeAll(tail, next(value)),
            onAmbiguous: () => failure(`Ambiguous option/flag: --${option}`),
          }),
        ),
      )
  }

  function consumeLongOpt(
    rest: string[],
    accumulator: Accumulator<A>,
  ): (match: string) => Either<Help, A> {
    return option =>
      pipe(
        accumulator.parseOption(Opts.Name.LongName(option)),
        Maybe.fold(
          () => Either.left(pipe(help, Help.withErrors(List.of(`Unexpected option: --${option}`)))),
          Accumulator.Match.fold({
            onFlag: next => consumeAll(rest, next),
            onOption: next =>
              List.isEmpty(rest)
                ? failure(`Missing value for option: --${option}`)
                : pipe(rest, ([h, ...t]) => consumeAll(t, next(h))),
            onAmbiguous: () => failure(`Ambiguous option/flag: --${option}`),
          }),
        ),
      )
  }

  function consumeArgs(args: string[], accumulator: Accumulator<A>): Either<Help, A> {
    if (List.isEmpty(args)) return evalResult(accumulator.result)

    const [arg, ...tail] = args
    return pipe(
      toOption(accumulator.parseArg(arg)),
      Maybe.fold(
        () => failure(`Unexpected argument: ${arg}`),
        next => consumeArgs(tail, next),
      ),
    )
  }

  function consumeShortOpt(
    rest: string[],
    accumulator: Accumulator<A>,
  ): (match: [string, string]) => Either<Help, A> {
    return ([flag, tail]) => {
      return pipe(
        consumeShort(flag, tail, accumulator),
        Either.chain(([newRest, newAccumulator]) => consumeAll(newRest, newAccumulator)),
      )

      function consumeShort(
        char: string,
        tail: string,
        accumulator: Accumulator<A>,
      ): Either<Help, [string[], Accumulator<A>]> {
        return pipe(
          accumulator.parseOption(Opts.Name.ShortName(char)),
          Maybe.fold(
            () => Either.left(pipe(help, Help.withErrors(List.of(`Unexpected option: -${char}`)))),
            Accumulator.Match.fold({
              onFlag: next =>
                pipe(
                  nonEmptyString(tail),
                  Maybe.fold(
                    () => Either.right([rest, next] as [string[], Accumulator<A>]),
                    ([nextFlag, nextTail]) => consumeShort(nextFlag, nextTail, next),
                  ),
                ),
              onOption: next =>
                StringUtils.isEmpty(tail)
                  ? pipe(
                      NonEmptyArray.fromArray(rest),
                      Maybe.fold(
                        () => failure(`Missing value for option: -${char}`),
                        ([v, ...r]) => Either.right([r, next(v)] as [string[], Accumulator<A>]),
                      ),
                    )
                  : Either.right([rest, next(tail)] as [string[], Accumulator<A>]),
              onAmbiguous: () => failure(`Ambiguous option/flag: -${char}`),
            }),
          ),
        )
      }
    }
  }

  function consumeDefault(
    arg: string,
    tail: string[],
    accumulator: Accumulator<A>,
  ): Either<Help, A> {
    return pipe(
      accumulator.parseSub(arg),
      Maybe.fold(
        () =>
          pipe(
            toOption(accumulator.parseArg(arg)),
            Maybe.fold(
              () => failure(`Unexpected argument: ${arg}`),
              next => consumeAll(tail, next),
            ),
          ),
        result =>
          pipe(
            result(tail),
            Either.mapLeft(Help.withPrefix(List.of(command.name))),
            Either.chain(evalResult),
          ),
      ),
    )
  }
}
