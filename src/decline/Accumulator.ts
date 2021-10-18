import util from 'util'
import { Functor1 } from 'fp-ts/Functor'
import { Lazy } from 'fp-ts/function'
import { pipeable } from 'fp-ts/pipeable'

import { Help } from './Help'
import { Opts } from './Opts'
import { Parser } from './Parser'
import { Result } from './Result'
import { Either, List, Maybe, NonEmptyArray, flow, pipe } from '../utils/fp'
import { apply } from 'fp-ts'

declare module 'fp-ts/lib/HKT' {
  type URItoKind<A> = {
    readonly Match: Accumulator.Match<A>
  };
}

const URI = 'Match'
type URI = typeof URI

export type ArgOut<A> = NonEmptyArray<Either<Accumulator<A>, Accumulator<A>>>
type Err<A> = Either<ReadonlyArray<string>, A>

export abstract class Accumulator<A> {
  abstract parseOption(name: Opts.Name): Maybe<Accumulator.Match<Accumulator<A>>>
  parseArg(_arg: string): ArgOut<A> {
    return NonEmptyArray.of(Either.left(this))
  }
  abstract parseSub(command: string): Maybe<(opts: ReadonlyArray<string>) => Either<Help, Result<A>>>
  abstract get result(): Result<A>

  mapValidated<B>(f: (a: A) => Err<B>): Accumulator<B> {
    return Accumulator.Validate(this, f)
  }
  map<B>(f: (a: A) => B): Accumulator<B> {
    return this.mapValidated(flow(f, Either.right))
  }
}

export namespace Accumulator {
  export type Match<A> = Match.MatchFlag<A> | Match.MatchOption<A> | Match.MatchAmbiguous

  export namespace Match {
    export type MatchFlag<A> = {
      readonly _tag: 'MatchFlag'
      readonly next: A
    };
    export const MatchFlag = <A>(next: A): MatchFlag<A> => ({ _tag: 'MatchFlag', next })
    export const isMatchFlag = <A>(match: Match<A>): match is MatchFlag<A> =>
      match._tag === 'MatchFlag'

    export type MatchOption<A> = {
      readonly _tag: 'MatchOption'
      readonly next: (str: string) => A
    };
    export const MatchOption = <A>(next: (str: string) => A): MatchOption<A> => ({
      _tag: 'MatchOption',
      next,
    })
    export const isMatchOption = <A>(match: Match<A>): match is MatchOption<A> =>
      match._tag === 'MatchOption'

    export type MatchAmbiguous = {
      readonly _tag: 'MatchAmbiguous'
    };
    export const MatchAmbiguous: MatchAmbiguous = { _tag: 'MatchAmbiguous' }

    const match: Functor1<URI> = {
      URI,
      map: <A, B>(fa: Match<A>, f: (a: A) => B): Match<B> =>
        pipe(
          fa,
          fold<A, Match<B>>({
            onFlag: _ => MatchFlag(f(_)),
            onOption: _ => MatchOption(flow(_, f)),
            onAmbiguous: () => MatchAmbiguous,
          }),
        ),
    }

    export const { map } = pipeable(match)

    export function fold<A, B>({
      onFlag,
      onOption,
      onAmbiguous,
    }: FoldArgs<A, B>): (fa: Match<A>) => B {
      return fa =>
        fa._tag === 'MatchFlag'
          ? onFlag(fa.next)
          : fa._tag === 'MatchOption'
          ? onOption(fa.next)
          : onAmbiguous()
    }
  }

  type FoldArgs<A, B> = {
    readonly onFlag: (a: A) => B
    readonly onOption: (next: (str: string) => A) => B
    readonly onAmbiguous: Lazy<B>
  };

  /**
   * subclasses
   */
  // eslint-disable-next-line @typescript-eslint/class-name-casing
  class _Pure<A> extends Accumulator<A> {
    constructor(public readonly value: Result<A>) {
      super()
    }

    parseOption(_name: Opts.Name): Maybe<Match<Accumulator<A>>> {
      return Maybe.none
    }

    parseSub(_command: string): Maybe<(opts: ReadonlyArray<string>) => Either<Help, Result<A>>> {
      return Maybe.none
    }

    get result(): Result<A> {
      return this.value
    }
  }
  export type Pure<A> = _Pure<A>
  export const Pure = <A>(value: Result<A>): Pure<A> => new _Pure(value)

  // eslint-disable-next-line @typescript-eslint/class-name-casing
  class _Ap<A, B> extends Accumulator<B> {
    constructor(public readonly left: Accumulator<(a: A) => B>, public readonly right: Accumulator<A>) {
      super()
    }

    parseOption(name: Opts.Name): Maybe<Match<Accumulator<B>>> {
      const left = this.left.parseOption(name)
      const right = this.right.parseOption(name)

      if (Maybe.isSome(left) && Maybe.isNone(right)) {
        return Maybe.some(
          pipe(
            left.value,
            Match.map(_ => Ap(_, this.right)),
          ),
        )
      }

      if (Maybe.isNone(left) && Maybe.isSome(right)) {
        return Maybe.some(
          pipe(
            right.value,
            Match.map(_ => Ap(this.left, _)),
          ),
        )
      }

      if (Maybe.isNone(left) && Maybe.isNone(right)) return Maybe.none

      return Maybe.some(Match.MatchAmbiguous)
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
                    newRight => Ap(newLeft, newRight),
                  ),
                ),
              ),
            newLeft => NonEmptyArray.of(Either.right(Ap(newLeft, this.right))),
          ),
        ),
      )
    }

    parseSub(command: string): Maybe<(opts: ReadonlyArray<string>) => Either<Help, Result<B>>> {
      const leftSub = pipe(
        this.left.parseSub(command),
        Maybe.map(parser =>
          flow(
            parser,
            Either.map(leftResult =>
              pipe(
                apply.sequenceT(Result.result)(leftResult, this.right.result),
                Result.map(([f, a]) => f(a)),
              ),
            ),
          ),
        ),
      )
      const rightSub = pipe(
        this.right.parseSub(command),
        Maybe.map(parser =>
          flow(
            parser,
            Either.map(rightResult =>
              pipe(
                apply.sequenceT(Result.result)(this.left.result, rightResult),
                Result.map(([f, a]) => f(a)),
              ),
            ),
          ),
        ),
      )
      return pipe(
        leftSub,
        Maybe.alt(() => rightSub),
      )
    }

    get result(): Result<B> {
      return pipe(this.left.result, Result.ap(this.right.result))
    }
  }
  export type Ap<A, B> = _Ap<A, B>
  export function Ap<A, B>(left: Accumulator<(a: A) => B>, right: Accumulator<A>): Ap<A, B> {
    return new _Ap(left, right)
  }

  // eslint-disable-next-line @typescript-eslint/class-name-casing
  export class _OrElse<A> extends Accumulator<A> {
    constructor(public readonly left: Accumulator<A>, public readonly right: Accumulator<A>) {
      super()
    }

    parseOption(name: Opts.Name): Maybe<Match<Accumulator<A>>> {
      const left = this.left.parseOption(name)
      const right = this.right.parseOption(name)

      if (Maybe.isSome(left) && Maybe.isSome(right)) {
        const matchLeft = left.value
        const matchRight = right.value

        if (Match.isMatchFlag(matchLeft) && Match.isMatchFlag(matchRight)) {
          return Maybe.some(Match.MatchFlag(OrElse(matchLeft.next, matchRight.next)))
        }

        if (Match.isMatchOption(matchLeft) && Match.isMatchOption(matchRight)) {
          return Maybe.some(Match.MatchOption(v => OrElse(matchLeft.next(v), matchRight.next(v))))
        }

        return Maybe.some(Match.MatchAmbiguous)
      }

      if (Maybe.isSome(left) && Maybe.isNone(right)) return left
      if (Maybe.isNone(left) && Maybe.isSome(right)) return right

      return Maybe.none
    }

    parseArg(arg: string): ArgOut<A> {
      return NonEmptyArray.concat(this.left.parseArg(arg), this.right.parseArg(arg))
    }

    parseSub(command: string): Maybe<(opts: ReadonlyArray<string>) => Either<Help, Result<A>>> {
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
              Result.alt(() => rh.right),
            ),
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
        Result.alt(() => this.right.result),
      )
    }
  }
  export type OrElse<A> = _OrElse<A>
  export function OrElse<A>(left: Accumulator<A>, right: Accumulator<A>): OrElse<A> {
    return new _OrElse(left, right)
  }

  // eslint-disable-next-line @typescript-eslint/class-name-casing
  class _Regular extends Accumulator<NonEmptyArray<string>> {
    constructor(public readonly names: ReadonlyArray<Opts.Name>, public readonly values: ReadonlyArray<string> = []) {
      super()
    }

    parseOption(name: Opts.Name): Maybe<Match<Accumulator<NonEmptyArray<string>>>> {
      return pipe(
        this.names,
        List.exists(_ => util.isDeepStrictEqual(_, name)),
      )
        ? Maybe.some(Match.MatchOption(v => Regular(this.names, List.cons(v, this.values))))
        : Maybe.none
    }

    parseSub(
      _command: string,
    ): Maybe<(opts: ReadonlyArray<string>) => Either<Help, Result<NonEmptyArray<string>>>> {
      return Maybe.none
    }

    get result(): Result<NonEmptyArray<string>> {
      return pipe(
        this.values,
        List.reverse,
        NonEmptyArray.fromArray,
        Maybe.map(Result.success),
        Maybe.getOrElse<Result<NonEmptyArray<string>>>(() => Result.fail),
      )
    }
  }
  export type Regular = _Regular
  export function Regular(names: ReadonlyArray<Opts.Name>, values: ReadonlyArray<string> = []): Regular {
    return new _Regular(names, values)
  }

  // eslint-disable-next-line @typescript-eslint/class-name-casing
  class _Argument extends Accumulator<string> {
    parseOption(_name: Opts.Name): Maybe<Match<Accumulator<string>>> {
      return Maybe.none
    }

    parseArg(arg: string): ArgOut<string> {
      return NonEmptyArray.of(Either.right(Pure(Result.success(arg))))
    }

    parseSub(_command: string): Maybe<(opts: ReadonlyArray<string>) => Either<Help, Result<string>>> {
      return Maybe.none
    }

    get result(): Result<string> {
      return Result.missingArgument
    }
  }
  export type Argument = _Argument
  export const Argument: Argument = new _Argument()

  // eslint-disable-next-line @typescript-eslint/class-name-casing
  class _Arguments extends Accumulator<NonEmptyArray<string>> {
    constructor(public readonly stack: ReadonlyArray<string>) {
      super()
    }

    parseOption(_name: Opts.Name): Maybe<Match<Accumulator<NonEmptyArray<string>>>> {
      return Maybe.none
    }

    parseArg(arg: string): ArgOut<NonEmptyArray<string>> {
      const noMore = Pure(
        Result(
          Either.right(() =>
            Either.right(pipe(NonEmptyArray.cons(arg, this.stack), NonEmptyArray.reverse)),
          ),
        ),
      )
      const yesMore = Arguments(List.cons(arg, this.stack))
      return NonEmptyArray.of(Either.right(OrElse(noMore, yesMore)))
    }

    parseSub(
      _command: string,
    ): Maybe<(opts: ReadonlyArray<string>) => Either<Help, Result<NonEmptyArray<string>>>> {
      return Maybe.none
    }

    get result(): Result<NonEmptyArray<string>> {
      return pipe(
        NonEmptyArray.fromArray(pipe(this.stack, List.reverse)),
        Maybe.fold(() => Result.missingArgument, Result.success),
      )
    }
  }
  export type Arguments = _Arguments
  export function Arguments(stack: ReadonlyArray<string>): Arguments {
    return new _Arguments(stack)
  }

  // eslint-disable-next-line @typescript-eslint/class-name-casing
  class _Subcommand<A> extends Accumulator<A> {
    constructor(public readonly name: string, public readonly action: Parser<A>) {
      super()
    }

    parseOption(_name: Opts.Name): Maybe<Match<Accumulator<A>>> {
      return Maybe.none
    }

    parseSub(command: string): Maybe<(opts: ReadonlyArray<string>) => Either<Help, Result<A>>> {
      const action = (opts: ReadonlyArray<string>) => this.action(opts)
      return command == this.name
        ? Maybe.some(flow(action, Either.map(Result.success)))
        : Maybe.none
    }

    get result(): Result<A> {
      return Result.missingCommand(this.name)
    }
  }
  export type Subcommand<A> = _Subcommand<A>
  export const Subcommand = <A>(name: string, action: Parser<A>): Subcommand<A> =>
    new _Subcommand(name, action)

  // eslint-disable-next-line @typescript-eslint/class-name-casing
  class _Validate<A, B> extends Accumulator<B> {
    constructor(public readonly a: Accumulator<A>, public readonly f: (a: A) => Either<ReadonlyArray<string>, B>) {
      super()
    }

    parseOption(name: Opts.Name): Maybe<Match<Accumulator<B>>> {
      return pipe(this.a.parseOption(name), Maybe.map(Match.map(_ => Validate(_, this.f))))
    }

    parseArg(arg: string): ArgOut<B> {
      return pipe(
        this.a.parseArg(arg),
        NonEmptyArray.map(
          Either.bimap(
            newA => newA.mapValidated(this.f),
            newA => newA.mapValidated(this.f),
          ),
        ),
      )
    }

    parseSub(command: string): Maybe<(opts: ReadonlyArray<string>) => Either<Help, Result<B>>> {
      return pipe(
        this.a.parseSub(command),
        Maybe.map(_ => flow(_, Either.map(Result.mapValidated(this.f)))),
      )
    }

    get result(): Result<B> {
      return pipe(this.a.result, Result.mapValidated(this.f))
    }
  }
  export type Validate<A, B> = _Validate<A, B>
  export function Validate<A, B>(
    a: Accumulator<A>,
    f: (a: A) => Either<ReadonlyArray<string>, B>,
  ): Validate<A, B> {
    return new _Validate(a, f)
  }

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
        return fromRepeated(opts.opt) as any

      case 'Subcommand':
        return Subcommand(opts.command.name, Parser(opts.command))

      case 'Validate':
        return fromOpts(opts.value).mapValidated(opts.validate)
    }
  }

  function fromSingle<A>(opt: Opts.Opt<A>): Accumulator<string> {
    switch (opt._tag) {
      case 'Regular':
        return Regular(opt.names).map(NonEmptyArray.last)

      case 'Argument':
        return Argument
    }
  }

  function fromRepeated<A>(opt: Opts.Opt<A>): Accumulator<NonEmptyArray<string>> {
    switch (opt._tag) {
      case 'Regular':
        return Regular(opt.names)

      case 'Argument':
        return Arguments([])
    }
  }
}

function squish<A>(argOut: ArgOut<A>): ArgOut<A> {
  const [a, ...tail] = argOut
  if (List.isEmpty(tail)) return argOut

  const [b, ...rest] = tail

  if (Either.isLeft(a) && Either.isLeft(b)) {
    return squish(NonEmptyArray.cons(Either.left(Accumulator.OrElse(a.left, b.left)), rest))
  }

  if (Either.isRight(a) && Either.isRight(b)) {
    return squish(NonEmptyArray.cons(Either.right(Accumulator.OrElse(a.right, b.right)), rest))
  }

  return NonEmptyArray.cons(a, squish(NonEmptyArray.cons(b, rest)))
}
