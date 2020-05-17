import * as t from 'io-ts'
import { sequenceT } from 'fp-ts/lib/Apply'
import { failure } from 'io-ts/lib/PathReporter'

import { Command } from './Command'
import { Commands } from './Commands'
import { Opts } from './Opts'
import { callsEmoji } from '../global'
import { TSnowflake } from '../models/TSnowflake'
import { ValidatedNea } from '../models/ValidatedNea'
import { pipe, Either, NonEmptyArray } from '../utils/fp'
import { StringUtils } from '../utils/StringUtils'

type AdminTextChannel = Commands.CallsInit | Commands.DefaultRoleGet | Commands.DefaultRoleSet

export type Cli = ReturnType<typeof Cli>

export function Cli(prefix: string) {
  return {
    adminTextChannel: Command({ name: prefix, header: 'Everyone pays!' })(
      pipe(
        Opts.subcommand(calls),
        Opts.alt<AdminTextChannel>(() => Opts.subcommand(defaultRole))
      )
    )
  }
}

const callsInit = Command({
  name: 'init',
  header: StringUtils.stripMargins(
    `Sends a message. Members reacting to it with ${callsEmoji} are added to the <role>.
    |After that, when a calls starts in this server, it will be notified in <channel> by mentionning <role>.`
  )
})<AdminTextChannel>(
  pipe(
    sequenceT(Opts.opts)(
      Opts.param('channel', decodeTextChannel),
      Opts.param('role', decodeMention)
    ),
    Opts.map(_ => Commands.CallsInit(..._))
  )
)
const calls = Command({
  name: 'calls',
  header:
    'When someone joins a voice channel and he is the only one connected to a public voice channel.'
})(Opts.subcommand(callsInit))

const defaultRoleGet = Command({ name: 'get', header: 'Show the default role for this server.' })(
  pipe(Opts.pure(Commands.DefaultRoleGet))
)
const defaultRoleSet = Command({ name: 'set', header: 'Set the default role for this server.' })(
  pipe(Opts.param('role', decodeMention), Opts.map(Commands.DefaultRoleSet))
)
const defaultRole = Command({
  name: 'defaultRole',
  header: 'Role for new members of this server.'
})(
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
