import { Help } from './Help'
import { Opts } from './Opts'
import { Parser } from './Parser'
import { ValidatedNea } from '../models/ValidatedNea'
import { Either, flow, pipe } from '../utils/fp'

export interface Command<A> {
  readonly name: string
  readonly opts: Opts<A>
}

export function Command(name: string): <A>(opts: Opts<A>) => Command<A> {
  return opts => ({ name, opts })
}

export namespace Command {
  export const parseHelp = <A>(args: string[]) => (cmd: Command<A>): Either<Help, A> =>
    Parser(cmd)(args)

  export const parse = <A>(args: string[]): ((cmd: Command<A>) => Either<string, A>) =>
    flow(parseHelp(args), Either.mapLeft(Help.stringify))

  export const mapValidated = <A, B>(f: (a: A) => ValidatedNea<string, B>) => (
    cmd: Command<A>
  ): Command<B> => Command(cmd.name)(pipe(cmd.opts, Opts.mapValidated(f)))

  export const map = <A, B>(f: (a: A) => B): ((cmd: Command<A>) => Command<B>) =>
    mapValidated(flow(f, Either.right))
}
