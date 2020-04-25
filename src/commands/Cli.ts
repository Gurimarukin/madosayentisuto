import * as t from 'io-ts'
import { failure } from 'io-ts/lib/PathReporter'

import { Command } from './Command'
import { Commands } from './Commands'
import { Opts } from './Opts'
import { pipe, Either } from '../utils/fp'

type AdminTextChannel = Commands.CallsSubscribe | Commands.CallsUnsubscribe | Commands.CallsIgnore

export namespace Cli {
  export const adminTextChannel = (prefix: string): Command<AdminTextChannel> =>
    Command(prefix)(
      Opts.subcommand(
        Command('calls')(
          pipe(
            Opts.subcommand<AdminTextChannel>(callsSubscribe),
            Opts.orElse(() => Opts.subcommand<AdminTextChannel>(callsUnsubscribe)),
            Opts.orElse(() => Opts.subcommand<AdminTextChannel>(callsIgnore))
          )
        )
      )
    )
}

const callsSubscribe = Command('subscribe')(Opts.pure(Commands.CallsSubscribe))
const callsUnsubscribe = Command('unsubscribe')(Opts.pure(Commands.CallsUnsubscribe))
const callsIgnore = Command('ignore')(
  pipe(Opts.argument('user', codecToDecode(t.string)), Opts.map(Commands.CallsIgnore))
)

function codecToDecode<I, A>(codec: t.Decoder<I, A>): (u: I) => Either<string, A> {
  return u =>
    pipe(
      codec.decode(u),
      Either.mapLeft(_ => failure(_).join('\n'))
    )
}
