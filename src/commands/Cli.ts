import * as t from 'io-ts'
import { sequenceT } from 'fp-ts/lib/Apply'
import { failure } from 'io-ts/lib/PathReporter'

import { Command } from './Command'
import { Commands } from './Commands'
import { Opts } from './Opts'
import { TSnowflake } from '../models/TSnowflake'
import { ValidatedNea } from '../models/ValidatedNea'
import { pipe, Either, NonEmptyArray } from '../utils/fp'

type AdminTextChannel = Commands.CallsInit | Commands.DefaultRoleGet | Commands.DefaultRoleSet

export type Cli = ReturnType<typeof Cli>

export function Cli(prefix: string) {
  return {
    adminTextChannel: Command(prefix)(
      pipe(
        Opts.subcommand(calls),
        Opts.alt<AdminTextChannel>(() => Opts.subcommand(defaultRole))
      )
    )
  }
}

const callsInit = Command('init')<AdminTextChannel>(
  pipe(
    sequenceT(Opts.opts)(
      Opts.param('channel', decodeTextChannel),
      Opts.param('mention', decodeMention)
    ),
    Opts.map(_ => Commands.CallsInit(..._))
  )
)
const calls = Command('calls')(Opts.subcommand(callsInit))

const defaultRoleGet = Command('get')(pipe(Opts.pure(Commands.DefaultRoleGet)))
const defaultRoleSet = Command('set')(
  pipe(Opts.param('role', decodeMention), Opts.map(Commands.DefaultRoleSet))
)
const defaultRole = Command('defaultRole')(
  pipe(
    Opts.subcommand(defaultRoleGet),
    Opts.alt<AdminTextChannel>(() => Opts.subcommand(defaultRoleSet))
  )
)

function decodeMention(u: string): ValidatedNea<string, TSnowflake> {
  return pipe(
    codecToDecode(t.string)(u),
    Either.chain(str =>
      str.startsWith('<@') && str.endsWith('>')
        ? pipe(
            str.slice(2, -1),
            sliced => (sliced.startsWith('!') || sliced.startsWith('&') ? sliced.slice(1) : sliced),
            Either.right
          )
        : Either.left(NonEmptyArray.of(`Invalid mention: ${str}`))
    ),
    Either.map(TSnowflake.wrap)
  )
}

function decodeTextChannel(u: string): ValidatedNea<string, TSnowflake> {
  return pipe(
    codecToDecode(t.string)(u),
    Either.chain(str =>
      str.startsWith('<#') && str.endsWith('>')
        ? pipe(str.slice(2, -1), TSnowflake.wrap, Either.right)
        : Either.left(NonEmptyArray.of(`Invalid channel: ${str}`))
    )
  )
}

function codecToDecode<I, A>(codec: t.Decoder<I, A>): (u: I) => ValidatedNea<string, A> {
  return u => pipe(codec.decode(u), Either.mapLeft(failure), ValidatedNea.fromEmptyErrors)
}
