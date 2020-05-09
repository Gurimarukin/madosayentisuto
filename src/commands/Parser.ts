import { sequenceT } from 'fp-ts/lib/Apply'
import { getValidation } from 'fp-ts/lib/Either'
import { eqString } from 'fp-ts/lib/Eq'
import { flow } from 'fp-ts/lib/function'
import { getSemigroup } from 'fp-ts/lib/NonEmptyArray'

import { Command } from './Command'
import { Help } from './Help'
import { Opts } from './Opts'
import { Result } from './Result'
import { Either, pipe, NonEmptyArray, Maybe, List } from '../utils/fp'
import { ValidatedNea } from '../models/ValidatedNea'

export type Parser<A> = (args: string[]) => Either<Help, A>
type ArgOut<A> = NonEmptyArray<Either<Accumulator<A>, Accumulator<A>>>
type Err<A> = Either<string[], A>

export const Parser = <A>(command: Command<A>): Parser<A> => {
  const help = Help.fromCommand(command)

  return args => consumeAll(args, Accumulator.fromOpts(command.opts))

  function failure<A>(...reasons: string[]): Either<Help, A> {
    return Either.left(pipe(help, Help.withErrors(reasons)))
  }

  function evalResult<A>(out: Result<A>): Either<Help, A> {
    return pipe(
      out,
      Either.fold(
        failed => failure(...pipe(failed, Result.Failure.messages, List.uniq(eqString))),
        // NB: if any of the user-provided functions have side-effects, they will happen here!
        fn =>
          pipe(
            fn(),
            Either.fold(
              messages => failure(...pipe(messages, List.uniq(eqString))),
              result => Either.right(result)
            )
          )
      )
    )
  }

  function toOption<B>(args: ArgOut<B>): Maybe<Accumulator<B>> {
    return pipe(
      args,
      List.filterMap(Maybe.fromEither),
      NonEmptyArray.fromArray,
      Maybe.map(([head, ...tail]) => pipe(tail, List.reduce(head, Accumulator.OrElse)))
    )
  }

  function consumeAll(args: string[], accumulator: Accumulator<A>): Either<Help, A> {
    if (List.isEmpty(args)) return evalResult(accumulator.result)

    const [arg, ...tail] = args
    return pipe(
      accumulator.parseSub(arg),
      Maybe.map(result =>
        pipe(
          result(tail),
          Either.mapLeft(Help.withPrefix([command.name])),
          Either.chain(evalResult)
        )
      ),
      Maybe.fold(
        () =>
          pipe(
            toOption(accumulator.parseArg(arg)),
            Maybe.fold(
              () => failure(`Unexpected argument: ${arg}`),
              next => consumeAll(tail, next)
            )
          ),
        _ => _
      )
    )
  }
}

const squish = <A>(argOut: ArgOut<A>): ArgOut<A> => {
  const [a, ...tail] = argOut
  if (List.isEmpty(tail)) return argOut

  const [b, ...rest] = tail

  if (Either.isLeft(a) && Either.isLeft(b)) {
    return squish(NonEmptyArray.cons(Either.left(Accumulator.OrElse(a.left, b.left)), rest))
  }

  if (Either.isRight(a) && Either.isRight(b)) {
    return squish(NonEmptyArray.cons(Either.right(Accumulator.OrElse(a.right, b.right)), rest))
  }

  return NonEmptyArray.cons(a, squish(NonEmptyArray.cons(a, rest)))
}

abstract class Accumulator<A> {
  parseArg(_arg: string): ArgOut<A> {
    return NonEmptyArray.of(Either.left(this))
  }
  abstract parseSub(command: string): Maybe<(opts: string[]) => Either<Help, Result<A>>>
  abstract get result(): Result<A>

  mapValidated<B>(f: (a: A) => Err<B>): Accumulator<B> {
    return Accumulator.Validate(this, f)
  }
  map<B>(f: (a: A) => B): Accumulator<B> {
    return this.mapValidated(flow(f, Either.right))
  }
}

namespace Accumulator {
  /**
   * subclasses
   */
  class APure<A> extends Accumulator<A> {
    constructor(public value: Result<A>) {
      super()
    }

    parseSub(_command: string): Maybe<(opts: string[]) => Either<Help, Result<A>>> {
      return Maybe.none
    }

    get result(): Result<A> {
      return this.value
    }
  }
  export type Pure<A> = APure<A>
  export const Pure = <A>(value: Result<A>): Pure<A> => new APure(value)

  class AAp<A, B> extends Accumulator<B> {
    constructor(public left: Accumulator<(a: A) => B>, public right: Accumulator<A>) {
      super()
    }

    parseArg(arg: string): ArgOut<B> {
      const parsedRight = squish(this.right.parseArg(arg))
      return pipe(
        squish(this.left.parseArg(arg)),
        NonEmptyArray.chain(
          // Left side can't accept the argument: try the right
          Either.fold(
            newLeft =>
              pipe(
                parsedRight,
                NonEmptyArray.map(
                  Either.bimap(
                    newRight => Ap(newLeft, newRight),
                    newRight => Ap(newLeft, newRight)
                  )
                )
              ),
            newLeft => NonEmptyArray.of(Either.right(Ap(newLeft, this.right)))
          )
        )
      )
    }

    parseSub(command: string): Maybe<(opts: string[]) => Either<Help, Result<B>>> {
      const leftSub = pipe(
        this.left.parseSub(command),
        Maybe.map(parser =>
          flow(
            parser,
            Either.map(leftResult =>
              pipe(
                // sequenceT(getValidation(getSemigroup<Result.Failure>()))(
                //   ValidatedNea.fromEither(leftResult),
                //   ValidatedNea.fromEither(this.right.result)
                // ),
                sequenceT(Either.either)(leftResult, this.right.result),
                Either.map(([fab, fa]) => () => pipe(fab(), Either.ap(fa())))
              )
            )
          )
        )
      )
      const rightSub = pipe(
        this.right.parseSub(command),
        Maybe.map(parser =>
          flow(
            parser,
            Either.map(rightResult =>
              pipe(
                sequenceT(Either.either)(this.left.result, rightResult),
                Either.map(([fab, fa]) => () => pipe(fab(), Either.ap(fa())))
              )
            )
          )
        )
      )
      return pipe(
        leftSub,
        Maybe.alt(() => rightSub)
      )
    }

    get result(): Result<B> {
      return pipe(this.left.result, Result.ap(this.right.result))
    }
  }
  export type Ap<A, B> = AAp<A, B>
  export const Ap = <A, B>(left: Accumulator<(a: A) => B>, right: Accumulator<A>): Ap<A, B> =>
    new AAp(left, right)

  export class AOrElse<A> extends Accumulator<A> {
    constructor(public left: Accumulator<A>, public right: Accumulator<A>) {
      super()
    }

    parseArg(arg: string): ArgOut<A> {
      return NonEmptyArray.concat(this.left.parseArg(arg), this.right.parseArg(arg))
    }

    parseSub(command: string): Maybe<(opts: string[]) => Either<Help, Result<A>>> {
      const resLeft = this.left.parseSub(command)
      const resRight = this.right.parseSub(command)

      if (Maybe.isSome(resLeft) && Maybe.isSome(resRight)) {
        return Maybe.some(args => {
          const lh = resLeft.value(args)
          if (Either.isLeft(lh)) return lh

          const rh = resRight.value(args)
          if (Either.isLeft(rh)) return rh

          return Either.right(
            pipe(
              lh.right,
              Either.alt(() => rh.right)
            )
          )
        })
      }

      if (Maybe.isSome(resLeft) && Maybe.isNone(resRight)) return resLeft
      if (Maybe.isNone(resLeft) && Maybe.isSome(resRight)) return resRight

      return Maybe.none
    }

    get result(): Result<A> {
      return pipe(
        this.left.result,
        Either.alt(() => this.right.result)
      )
    }
  }
  export type OrElse<A> = AOrElse<A>
  export const OrElse = <A>(left: Accumulator<A>, right: Accumulator<A>): OrElse<A> =>
    new AOrElse(left, right)

  class AArgument extends Accumulator<string> {
    parseArg(arg: string): ArgOut<string> {
      return NonEmptyArray.of(Either.right(Pure(Result.success(arg))))
    }

    parseSub(_command: string): Maybe<(opts: string[]) => Either<Help, Result<string>>> {
      return Maybe.none
    }

    get result(): Result<string> {
      return Result.missingArgument
    }
  }
  export type Argument = AArgument
  export const Argument: Argument = new AArgument()

  class AArguments extends Accumulator<NonEmptyArray<string>> {
    constructor(public stack: string[]) {
      super()
    }

    parseArg(arg: string): ArgOut<NonEmptyArray<string>> {
      const noMore = Pure(
        Either.right(() =>
          Either.right(pipe(NonEmptyArray.cons(arg, this.stack), NonEmptyArray.reverse))
        )
      )
      const yesMore = Arguments(List.cons(arg, this.stack))
      return NonEmptyArray.of(Either.right(OrElse(noMore, yesMore)))
    }

    parseSub(
      _command: string
    ): Maybe<(opts: string[]) => Either<Help, Result<NonEmptyArray<string>>>> {
      return Maybe.none
    }

    get result(): Result<NonEmptyArray<string>> {
      return pipe(
        NonEmptyArray.fromArray(pipe(this.stack, List.reverse)),
        Maybe.fold(() => Result.missingArgument, Result.success)
      )
    }
  }
  export type Arguments = AArguments
  export const Arguments = (stack: string[]): Arguments => new AArguments(stack)

  class ASubcommand<A> extends Accumulator<A> {
    constructor(public name: string, public action: Parser<A>) {
      super()
    }

    parseSub(command: string): Maybe<(opts: string[]) => Either<Help, Result<A>>> {
      const action = (opts: string[]) => this.action(opts)
      return command == this.name
        ? Maybe.some(flow(action, Either.map(Result.success)))
        : Maybe.none
    }

    get result(): Result<A> {
      return Result.missingCommand(this.name)
    }
  }
  export type Subcommand<A> = ASubcommand<A>
  export const Subcommand = <A>(name: string, action: Parser<A>): Subcommand<A> =>
    new ASubcommand(name, action)

  class AValidate<A, B> extends Accumulator<B> {
    constructor(public a: Accumulator<A>, public f: (a: A) => Either<string[], B>) {
      super()
    }

    parseArg(arg: string): ArgOut<B> {
      return pipe(
        this.a.parseArg(arg),
        NonEmptyArray.map(
          Either.bimap(
            newA => newA.mapValidated(this.f),
            newA => newA.mapValidated(this.f)
          )
        )
      )
    }

    parseSub(command: string): Maybe<(opts: string[]) => Either<Help, Result<B>>> {
      return pipe(
        this.a.parseSub(command),
        Maybe.map(_ => flow(_, Either.map(Result.mapValidated(this.f))))
      )
    }

    get result(): Result<B> {
      return pipe(this.a.result, Result.mapValidated(this.f))
    }
  }
  export type Validate<A, B> = AValidate<A, B>
  export const Validate = <A, B>(
    a: Accumulator<A>,
    f: (a: A) => Either<string[], B>
  ): Validate<A, B> => new AValidate(a, f)

  /**
   * helpers
   */
  export const fromOpts = <A>(opts: Opts<A>): Accumulator<A> => {
    switch (opts._tag) {
      case 'Pure':
        return Pure(Result.success(opts.a))

      case 'App':
        return Ap(fromOpts(opts.f), fromOpts(opts.a))

      case 'OrElse':
        return OrElse(fromOpts(opts.a), fromOpts(opts.b))

      case 'Single':
        return fromSingle(opts.opt) as any

      case 'Repeated':
        return repeated(opts.opt) as any

      case 'Subcommand':
        return Subcommand(opts.command.name, Parser(opts.command))

      case 'Validate':
        return fromOpts(opts.value).mapValidated(opts.validate)
    }
  }

  const fromSingle = <A>(opt: Opts.Opt<A>): Accumulator<string> => {
    switch (opt._tag) {
      case 'Argument':
        return Argument
    }
  }

  const repeated = <A>(opt: Opts.Opt<A>): Accumulator<NonEmptyArray<string>> => {
    switch (opt._tag) {
      case 'Argument':
        return Arguments([])
    }
  }
}
