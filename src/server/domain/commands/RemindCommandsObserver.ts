import type { APIRole } from 'discord-api-types/payloads/v9'
import { Role } from 'discord.js'
import type { CommandInteraction, Guild, TextBasedChannel, User } from 'discord.js'
import { apply, ord } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'

import { DayJs } from '../../../shared/models/DayJs'
import { DiscordUserId } from '../../../shared/models/DiscordUserId'
import { MsDuration } from '../../../shared/models/MsDuration'
import { GuildId } from '../../../shared/models/guild/GuildId'
import { Dict, Either, List, Tuple } from '../../../shared/utils/fp'
import { Future, Maybe } from '../../../shared/utils/fp'
import { futureMaybe } from '../../../shared/utils/futureMaybe'

import { DiscordConnector } from '../../helpers/DiscordConnector'
import { ChannelId } from '../../models/ChannelId'
import { Command } from '../../models/Command'
import { RoleId } from '../../models/RoleId'
import { MadEvent } from '../../models/event/MadEvent'
import { ObserverWithRefinement } from '../../models/rx/ObserverWithRefinement'
import type { ReminderWho } from '../../models/scheduledEvent/ReminderWho'
import { ScheduledEvent } from '../../models/scheduledEvent/ScheduledEvent'
import type { ScheduledEventService } from '../../services/ScheduledEventService'

const Keys = {
  remind: 'rappel',
  who: 'qui',
  when: 'quand',
  what: 'quoi',
}

const remindCommand = Command.chatInput({
  name: Keys.remind,
  description: 'Jean Plank vous mettra un rappel',
})(
  Command.option.string({
    name: Keys.when,
    description:
      'Une durée : "3h", "1 jour", "5 min", ou une date "29/02/2044", "31/12/2065 12:12", "21:59"',
    required: true,
  }),
  Command.option.string({
    name: Keys.what,
    description: 'Description',
    required: true,
  }),
  Command.option.role({
    name: Keys.who,
    description:
      "Le rôle qui sera notifié dans le présent salon - si absent, c'est toi qui seras notifié en MP",
  }),
)

export const remindCommands = [remindCommand]

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const RemindCommandsObserver = (scheduledEventService: ScheduledEventService) => {
  return ObserverWithRefinement.fromNext(
    MadEvent,
    'InteractionCreate',
  )(({ interaction }) => {
    if (interaction.isCommand()) return onCommand(interaction)
    return Future.unit
  })

  function onCommand(interaction: CommandInteraction): Future<void> {
    const [who, fetchRole] = parseWho(
      interaction.guild,
      interaction.options.getRole(Keys.who),
      interaction.channel,
    )
    return pipe(
      who,
      Maybe.fold<ReminderWho, Future<Maybe<Role | User>>>(
        () => futureMaybe.some(interaction.user),
        () => fetchRole,
      ),
      futureMaybe.bindTo('whoMention'),
      futureMaybe.apS('now', futureMaybe.fromIO(DayJs.now)),
      futureMaybe.bind('reminder', ({ now }) =>
        futureMaybe.some(parseReminder(interaction, who, now)),
      ),
      futureMaybe.chain(({ whoMention, reminder }) => createReminder(whoMention, reminder)),
      Future.map(Maybe.getOrElse(() => Either.left('Erreur'))),
      Future.chain(
        Either.fold(
          error =>
            DiscordConnector.interactionReply(interaction, { content: error, ephemeral: true }),
          content =>
            DiscordConnector.interactionReply(interaction, {
              content,
              ephemeral: Maybe.isNone(who), // no role, user will get a DM
            }),
        ),
      ),
    )
  }

  function createReminder(
    whoMention: Role | User,
    event: Either<string, ScheduledEvent>,
  ): Future<Maybe<Either<string, string>>> {
    return pipe(
      event,
      Either.fold(flow(Either.left, futureMaybe.some), e =>
        pipe(
          scheduledEventService.create(e),
          Future.map(success =>
            success
              ? Maybe.some(
                  Either.right(
                    `Rappel pour ${whoMention} le **${pipe(
                      e.scheduledAt,
                      DayJs.format('DD/MM/YYYY, HH:mm'),
                    )}** : *${e.reminder.what}*`,
                  ),
                )
              : Maybe.none,
          ),
        ),
      ),
    )
  }
}

const parseReminder = (
  interaction: CommandInteraction,
  who: Maybe<ReminderWho>,
  now: DayJs,
): Either<string, ScheduledEvent> =>
  pipe(
    parseWhen(now, interaction.options.getString(Keys.when)),
    Either.fromOption(() => 'Durée ou date invalide'),
    Either.filterOrElse(
      when => ord.lt(DayJs.Ord)(now, when),
      () => 'Le rappel ne peut pas être dans le passé',
    ),
    Either.bindTo('scheduledAt'),
    Either.apS(
      'what',
      pipe(
        interaction.options.getString(Keys.what),
        Either.fromNullable(`<${Keys.what}> manquant`),
      ),
    ),
    Either.map(({ scheduledAt, what }) =>
      ScheduledEvent.Reminder({
        createdAt: now,
        scheduledAt,
        reminder: {
          createdBy: DiscordUserId.fromUser(interaction.user),
          who,
          what,
        },
      }),
    ),
  )

const parseWho = (
  nullableGuild: Guild | null,
  nullableRole: Role | APIRole | null,
  nullableChannel: TextBasedChannel | null,
): Tuple<Maybe<ReminderWho>, Future<Maybe<Role>>> =>
  Tuple.of(
    apply.sequenceS(Maybe.Apply)({
      guild: pipe(Maybe.fromNullable(nullableGuild), Maybe.map(GuildId.fromGuild)),
      role: pipe(Maybe.fromNullable(nullableRole), Maybe.map(RoleId.fromRole)),
      channel: pipe(Maybe.fromNullable(nullableChannel), Maybe.map(ChannelId.fromChannel)),
    }),
    pipe(
      apply.sequenceS(Maybe.Apply)({
        guild: Maybe.fromNullable(nullableGuild),
        role: Maybe.fromNullable(nullableRole),
      }),
      futureMaybe.fromOption,
      futureMaybe.chain(({ guild, role }) =>
        role instanceof Role
          ? Future.right(Maybe.some(role))
          : DiscordConnector.fetchRole(guild, RoleId.fromRole(role)),
      ),
    ),
  )

const parseWhen = (now: DayJs, str: string | null): Maybe<DayJs> =>
  str === null
    ? Maybe.none
    : pipe(
        parseDayJs(str),
        Maybe.alt(() => parseMs(now, str)),
        Maybe.map(d => {
          const startOfMinute = pipe(d, DayJs.startOf('minute'))
          return ord.lt(DayJs.Ord)(d, pipe(startOfMinute, DayJs.add(MsDuration.seconds(30))))
            ? startOfMinute
            : pipe(startOfMinute, DayJs.add(MsDuration.minute(1)))
        }),
      )

const dateFormat = 'DD/MM/YYYY'
const timeFormat = 'HH:mm'
const dateTimeFormat = `${dateFormat} ${timeFormat}`

const parseDayJs = (str: string): Maybe<DayJs> =>
  pipe(
    parseFormat(dateFormat, str),
    Maybe.alt(() => parseFormat(timeFormat, str)),
    Maybe.alt(() => parseFormat(dateTimeFormat, str)),
  )

const parseFormat = (format: string, str: string): Maybe<DayJs> =>
  pipe(DayJs.of(str, format), Maybe.fromPredicate(DayJs.isValid))

const parseMs = (now: DayJs, str: string): Maybe<DayJs> =>
  pipe(
    replaceUnits,
    Dict.toReadonlyArray,
    List.reduce(str.toLowerCase(), (acc, [fr, unit]) => acc.replaceAll(fr, unit)),
    MsDuration.fromString,
    Maybe.map(ms => pipe(now, DayJs.add(ms))),
  )

// copypasta from ms
type Unit =
  | 'Years'
  | 'Year'
  | 'Yrs'
  | 'Yr'
  | 'Y'
  | 'Weeks'
  | 'Week'
  | 'W'
  | 'Days'
  | 'Day'
  | 'D'
  | 'Hours'
  | 'Hour'
  | 'Hrs'
  | 'Hr'
  | 'H'
  | 'Minutes'
  | 'Minute'
  | 'Mins'
  | 'Min'
  | 'M'
  | 'Seconds'
  | 'Second'
  | 'Secs'
  | 'Sec'
  | 's'
  | 'Milliseconds'
  | 'Millisecond'
  | 'Msecs'
  | 'Msec'
  | 'Ms'

const replaceUnits: Dict<string, Unit> = {
  années: 'Years',
  annees: 'Years',
  année: 'Year',
  annee: 'Year',
  ans: 'Yrs',
  an: 'Yr',
  a: 'Y',
  semaines: 'Weeks',
  semaine: 'Week',
  sem: 'W',
  jours: 'Days',
  jour: 'Day',
  j: 'D',
  heures: 'Hours',
  heure: 'Hour',
  secondes: 'Seconds',
  seconde: 'Second',
}
