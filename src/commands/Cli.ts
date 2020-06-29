import * as t from 'io-ts'
import { sequenceT } from 'fp-ts/lib/Apply'
import { failure } from 'io-ts/lib/PathReporter'

import { Command } from '../decline/Command'
import { Opts } from '../decline/Opts'
import { Commands } from './Commands'
import { callsEmoji } from '../global'
import { ActivityConfig } from '../config/Config'
import { ActivityTypeBot } from '../models/ActivityTypeBot'
import { TSnowflake } from '../models/TSnowflake'
import { ValidatedNea } from '../models/ValidatedNea'
import { pipe, Either, NonEmptyArray, Maybe } from '../utils/fp'
import { StringUtils } from '../utils/StringUtils'

type AdminTextChannel =
  | Commands.CallsInit
  | Commands.DefaultRoleGet
  | Commands.DefaultRoleSet
  | Commands.Say
  | Commands.ActivityGet
  | Commands.ActivityUnset
  | Commands.ActivitySet

/**
 * calls
 */
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
  header: 'When someone starts a call in a voice channel.'
})(Opts.subcommand(callsInit))

/**
 * defaultRole
 */
const defaultRoleGet = Command({ name: 'get', header: 'Show the default role for this server.' })(
  Opts.pure(Commands.DefaultRoleGet)
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

/**
 * say
 */
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
    sequenceT(Opts.opts)(attach, Opts.param(Either.right)('message')),
    Opts.map(_ => Commands.Say(..._))
  )
)

/**
 * activity
 */
const activityGet = Command({ name: 'get', header: "Get the current Bot's activity." })(
  pipe(Opts.pure(Commands.ActivityGet))
)

const activityUnset = Command({ name: 'unset', header: "Unset Bot's activity status." })(
  Opts.pure(Commands.ActivityUnset)
)

const rawActivityCodec = t.union([
  t.literal('play'),
  t.literal('stream'),
  t.literal('listen'),
  t.literal('watch')
])
type RawActivity = t.TypeOf<typeof rawActivityCodec>
function fromRaw(raw: RawActivity): ActivityTypeBot {
  switch (raw) {
    case 'play':
      return 'PLAYING'
    case 'stream':
      return 'STREAMING'
    case 'listen':
      return 'LISTENING'
    case 'watch':
      return 'WATCHING'
  }
}
const activitySet = Command({ name: 'set', header: "Set Bot's activity status." })(
  pipe(
    sequenceT(Opts.opts)(
      Opts.option(codecToDecode(rawActivityCodec))({
        long: 'type',
        help: 'Type of activity.',
        metavar: pipe(
          rawActivityCodec.types.map(_ => _.value),
          StringUtils.mkString('|')
        ),
        short: 't'
      }),
      Opts.param(Either.right)('message')
    ),
    Opts.map(([type, name]) =>
      Commands.ActivitySet(Maybe.some(ActivityConfig(fromRaw(type), name)))
    )
  )
)

const activityRefresh = Command({ name: 'refresh', header: "Refresh Bot's activity status." })(
  Opts.pure(Commands.ActivitySet(Maybe.none))
)

const activity = Command({
  name: 'activity',
  header: "Bot's activity status."
})(
  pipe(
    Opts.subcommand(activityGet),
    Opts.alt<AdminTextChannel>(() => Opts.subcommand(activityUnset)),
    Opts.alt<AdminTextChannel>(() => Opts.subcommand(activitySet)),
    Opts.alt<AdminTextChannel>(() => Opts.subcommand(activityRefresh))
  )
)

export type Cli = ReturnType<typeof Cli>

export function Cli(prefix: string) {
  return {
    adminTextChannel: Command({ name: prefix, header: 'Everyone pays!' })(
      pipe(
        Opts.subcommand(calls),
        Opts.alt<AdminTextChannel>(() => Opts.subcommand(defaultRole)),
        Opts.alt<AdminTextChannel>(() => Opts.subcommand(say)),
        Opts.alt<AdminTextChannel>(() => Opts.subcommand(activity))
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

function codecToDecode<I, A>(codec: t.Decoder<I, A>): (u: I) => ValidatedNea<string, A> {
  return u => pipe(codec.decode(u), Either.mapLeft(failure), ValidatedNea.fromEmptyErrors)
}
