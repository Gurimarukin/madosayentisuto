import { sequenceT } from 'fp-ts/lib/Apply'
import * as t from 'io-ts'
import { failure } from 'io-ts/lib/PathReporter'

import { Command } from '../decline/Command'
import { Opts } from '../decline/Opts'
import { callsEmoji } from '../global'
import { Activity } from '../models/Activity'
import { ActivityTypeBot } from '../models/ActivityTypeBot'
import { TSnowflake } from '../models/TSnowflake'
import { ValidatedNea } from '../models/ValidatedNea'
import { Either, NonEmptyArray, pipe } from '../utils/fp'
import { StringUtils } from '../utils/StringUtils'
import { Commands } from './Commands'

type UserTextChannel = Commands.Kouizine | Commands.Image

type AdminTextChannel =
  | UserTextChannel
  | Commands.CallsInit
  | Commands.DefaultRoleGet
  | Commands.DefaultRoleSet
  | Commands.Say
  | Commands.ActivityGet
  | Commands.ActivityUnset
  | Commands.ActivitySet
  | Commands.ActivityRefresh

/**
 * calls
 */
const callsInit = Command({
  name: 'init',
  header: StringUtils.stripMargins(
    `Jean Plank envoie un message. Les membres d'équipage qui réagissent avec ${callsEmoji} obtiennent le rôle <role>.
    |À la suite de quoi, lorsqu'un appel commence sur le serveur, ils seront notifiés dans le salon <channel> en étant mentionné par le rôle <role>.`,
  ),
})<AdminTextChannel>(
  pipe(
    sequenceT(Opts.opts)(
      Opts.param(decodeTextChannel)('channel'),
      Opts.param(decodeMention)('role'),
    ),
    Opts.map(_ => Commands.CallsInit(..._)),
  ),
)

const calls = Command({
  name: 'calls',
  header: "Jean Plank n'est pas votre secrétaire mais gère vos appels.",
})(Opts.subcommand(callsInit))

/**
 * defaultRole
 */
const defaultRoleGet = Command({
  name: 'get',
  header: 'Jean Plank vous informe du rôle par défaut de ce serveur.',
})(Opts.pure(Commands.DefaultRoleGet))

const defaultRoleSet = Command({
  name: 'set',
  header: 'Jean Plank veut bien changer le rôle par défaut de ce serveur.',
})(pipe(Opts.param(decodeMention)('role'), Opts.map(Commands.DefaultRoleSet)))

const defaultRole = Command({
  name: 'defaultRole',
  header: "Jean Plank donne un rôle au nouveau membres d'équipages.",
})(
  pipe(
    Opts.subcommand(defaultRoleGet),
    Opts.alt<AdminTextChannel>(() => Opts.subcommand(defaultRoleSet)),
  ),
)

/**
 * say
 */
const attach = pipe(
  Opts.options(Either.right)({
    long: 'attach',
    help: 'Jean Plank ne sait pas dessiner, mais il peut envoyer des images.',
    short: 'a',
    metavar: 'url',
  }),
  Opts.orEmpty,
)

const say = Command({
  name: 'say',
  header: 'Jean Plank prend la parole.',
})(
  pipe(
    sequenceT(Opts.opts)(attach, Opts.param(Either.right)('message')),
    Opts.map(_ => Commands.Say(..._)),
  ),
)

/**
 * activity
 */
const activityGet = Command({
  name: 'get',
  header: "Jean Plank veut bien répéter ce qu'il est en train de faire.",
})(Opts.pure(Commands.ActivityGet))

const activityUnset = Command({
  name: 'unset',
  header: "Jean Plank a finit ce qu'il était en train de faire.",
})(Opts.pure(Commands.ActivityUnset))

const rawActivityCodec = t.union([
  t.literal('play'),
  t.literal('stream'),
  t.literal('listen'),
  t.literal('watch'),
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
const activitySet = Command({
  name: 'set',
  header: "Jean Plank annonce au monde qu'il est un homme occupé.",
})(
  pipe(
    sequenceT(Opts.opts)(
      Opts.param(codecToDecode(rawActivityCodec))(
        pipe(
          rawActivityCodec.types.map(_ => _.value),
          StringUtils.mkString('|'),
        ),
      ),
      Opts.param(Either.right)('message'),
    ),
    Opts.map(([type, name]) => Commands.ActivitySet(Activity(fromRaw(type), name))),
  ),
)

const activityRefresh = Command({
  name: 'refresh',
  header: "Jean Plank a parfois besoin de rappeler au monde qu'il est un homme occupé.",
})(Opts.pure(Commands.ActivityRefresh))

const activity = Command({
  name: 'activity',
  header: 'Jean Plank est un homme occupé et le fait savoir.',
})(
  pipe(
    Opts.subcommand(activityGet),
    Opts.alt<AdminTextChannel>(() => Opts.subcommand(activityUnset)),
    Opts.alt<AdminTextChannel>(() => Opts.subcommand(activitySet)),
    Opts.alt<AdminTextChannel>(() => Opts.subcommand(activityRefresh)),
  ),
)

/**
 * kouizine
 */
const kouizine = Command({
  name: 'kouizine',
  header: 'Jean Plank, galant homme, remet les femmes à leur place.',
})(Opts.pure(Commands.Kouizine))

/**
 * <image>
 */
const image = pipe(Opts.param(codecToDecode(t.string))('image'), Opts.map(Commands.Image))

export type Cli = ReturnType<typeof Cli>

const header = 'Tout le monde doit payer !'

export function Cli(prefix: string) {
  const userTextChannelOpts: Opts<UserTextChannel> = pipe(
    Opts.subcommand(kouizine),
    Opts.alt<UserTextChannel>(() => image),
  )

  const userTextChannel = Command({ name: prefix, header })<UserTextChannel>(userTextChannelOpts)

  const adminTextChannel = Command({ name: prefix, header })<AdminTextChannel>(
    pipe(
      Opts.subcommand(calls),
      Opts.alt<AdminTextChannel>(() => Opts.subcommand(defaultRole)),
      Opts.alt<AdminTextChannel>(() => Opts.subcommand(say)),
      Opts.alt<AdminTextChannel>(() => Opts.subcommand(activity)),
      Opts.alt<AdminTextChannel>(() => userTextChannelOpts),
    ),
  )

  return { adminTextChannel, userTextChannel }
}

function decodeMention(u: string): ValidatedNea<string, TSnowflake> {
  return pipe(
    u.startsWith('<@') && u.endsWith('>')
      ? pipe(
          u.slice(2, -1),
          sliced => (sliced.startsWith('!') || sliced.startsWith('&') ? sliced.slice(1) : sliced),
          Either.right,
        )
      : Either.left(NonEmptyArray.of(`Invalid mention: ${u}`)),
    Either.map(TSnowflake.wrap),
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
