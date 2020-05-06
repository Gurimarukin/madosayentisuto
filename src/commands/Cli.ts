import * as t from 'io-ts'
import { failure } from 'io-ts/lib/PathReporter'

import { Command } from './Command'
import { Commands } from './Commands'
import { CommandWithPrefix } from './CommandWithPrefix'
import { Opts } from './Opts'
import { TSnowflake } from '../models/TSnowflake'
import { pipe, Either } from '../utils/fp'

type AdminTextChannel = Commands.DefaultRoleSet

export namespace Cli {
  export const adminTextChannel = (prefix: string): CommandWithPrefix<AdminTextChannel> =>
    CommandWithPrefix(prefix, Command('defaultRole')(Opts.subcommand(defaultRoleSet)))
}

const defaultRoleSet = Command('set')(
  pipe(Opts.argument('role', decodeMention), Opts.map(Commands.DefaultRoleSet))
)

function decodeMention(u: string): Either<string, TSnowflake> {
  return pipe(
    codecToDecode(t.string)(u),
    Either.chain(str =>
      str.startsWith('<@') && str.endsWith('>')
        ? pipe(
            str.slice(2, -1),
            sliced => (sliced.startsWith('!') || sliced.startsWith('&') ? sliced.slice(1) : sliced),
            Either.right
          )
        : Either.left(`Invalid mention: ${str}`)
    ),
    Either.map(TSnowflake.wrap)
  )
}

function codecToDecode<I, A>(codec: t.Decoder<I, A>): (u: I) => Either<string, A> {
  return u =>
    pipe(
      codec.decode(u),
      Either.mapLeft(_ => failure(_).join('\n'))
    )
}
