// import * as t from 'io-ts'
import { sequenceT } from 'fp-ts/lib/Apply'
// import { failure } from 'io-ts/lib/PathReporter'

import { Command } from './Command'
import { Commands } from './Commands'
import { Opts } from './Opts'
import { callsEmoji } from '../global'
import { TSnowflake } from '../models/TSnowflake'
import { ValidatedNea } from '../models/ValidatedNea'
import { pipe, Either, NonEmptyArray } from '../utils/fp'
import { StringUtils } from '../utils/StringUtils'

type AdminTextChannel =
  | Commands.CallsInit
  | Commands.DefaultRoleGet
  | Commands.DefaultRoleSet
  | Commands.Say

const callsInit = Command({
  name: 'init',
  header: StringUtils.stripMargins(
    `Sends a message. Members reacting to it with ${callsEmoji} are added to the <role>.
    |After that, when a calls starts in this server, it will be notified in <channel> by mentionning <role>.`
  )
})<AdminTextChannel>(
  pipe(
    sequenceT(Opts.opts)(
      Opts.param(decodeTextChannel)('channel'),
      Opts.param(decodeMention)('role')
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
  pipe(Opts.param(decodeMention)('role'), Opts.map(Commands.DefaultRoleSet))
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

const attach = pipe(
  Opts.options(Either.right)({
    long: 'attach',
    help: 'Add attachment.',
    short: 'a',
    metavar: 'url'
  }),
  Opts.orEmpty
)
const say = Command({
  name: 'say',
  header: 'Make the bot say something.'
})(
  pipe(
    sequenceT(Opts.opts)(attach, Opts.params(Either.right)('things')),
    Opts.map(_ => Commands.Say(..._))
  )
)

export type Cli = ReturnType<typeof Cli>

export function Cli(prefix: string) {
  return {
    adminTextChannel: Command({ name: prefix, header: 'Everyone pays!' })(
      pipe(
        Opts.subcommand(calls),
        Opts.alt<AdminTextChannel>(() => Opts.subcommand(defaultRole)),
        Opts.alt<AdminTextChannel>(() => Opts.subcommand(say))
      )
    )
  }
}

function decodeMention(u: string): ValidatedNea<string, TSnowflake> {
  return pipe(
    u.startsWith('<@') && u.endsWith('>')
      ? pipe(
          u.slice(2, -1),
          sliced => (sliced.startsWith('!') || sliced.startsWith('&') ? sliced.slice(1) : sliced),
          Either.right
        )
      : Either.left(NonEmptyArray.of(`Invalid mention: ${u}`)),
    Either.map(TSnowflake.wrap)
  )
}

function decodeTextChannel(u: string): ValidatedNea<string, TSnowflake> {
  return u.startsWith('<#') && u.endsWith('>')
    ? pipe(u.slice(2, -1), TSnowflake.wrap, Either.right)
    : Either.left(NonEmptyArray.of(`Invalid channel: ${u}`))
}

// function codecToDecode<I, A>(codec: t.Decoder<I, A>): (u: I) => ValidatedNea<string, A> {
//   return u => pipe(codec.decode(u), Either.mapLeft(failure), ValidatedNea.fromEmptyErrors)
// }
