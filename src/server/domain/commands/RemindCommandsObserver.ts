import type { APIRole } from 'discord-api-types/payloads/v9'
import { Role } from 'discord.js'
import type { CommandInteraction, Guild, User } from 'discord.js'
import { apply, ord } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { DayJs } from '../../../shared/models/DayJs'
import { DiscordUserId } from '../../../shared/models/DiscordUserId'
import { MsDuration } from '../../../shared/models/MsDuration'
import { Dict, Either, List, Tuple, toUnit } from '../../../shared/utils/fp'
import { Future, Maybe } from '../../../shared/utils/fp'
import { futureMaybe } from '../../../shared/utils/futureMaybe'

import { DiscordConnector } from '../../helpers/DiscordConnector'
import { Command } from '../../models/Command'
import { RoleId } from '../../models/RoleId'
import { MadEvent } from '../../models/event/MadEvent'
import { ObserverWithRefinement } from '../../models/rx/ObserverWithRefinement'
import type { Reminder } from '../../models/scheduledEvent/Reminder'
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
    const [who, fetchRole] = parseWho(interaction.guild, interaction.options.getRole(Keys.who))
    return pipe(
      DiscordConnector.interactionDeferReply(interaction, { ephemeral: Maybe.isNone(who) }), // no role, user will get a DM
      Future.chain(() =>
        pipe(
          who,
          Maybe.fold<RoleId, Future<Maybe<Role | User>>>(
            () => futureMaybe.some(interaction.user),
            () => fetchRole,
          ),
        ),
      ),
      futureMaybe.bindTo('whoMention'),
      futureMaybe.apS('now', futureMaybe.fromIO(DayJs.now)),
      futureMaybe.bind('reminder', ({ now }) =>
        futureMaybe.some(parseReminder(interaction, who, now)),
      ),
      futureMaybe.chain(({ whoMention, reminder }) => createReminder(whoMention, reminder)),
      Future.map(Maybe.getOrElse(() => 'Erreur')),
      Future.chain(content => DiscordConnector.interactionFollowUp(interaction, { content })),
      Future.map(toUnit),
    )
  }

  function createReminder(
    whoMention: Role | User,
    reminder: Either<string, Reminder>,
  ): Future<Maybe<string>> {
    return pipe(
      reminder,
      Either.fold(futureMaybe.some, r =>
        pipe(
          scheduledEventService.createReminder(r),
          Future.map(success =>
            success
              ? Maybe.some(
                  `Rappel pour ${whoMention} le **${pipe(
                    r.when,
                    DayJs.format('DD/MM/YYYY, HH:mm'),
                  )}** : *${r.what}*`,
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
  who: Maybe<RoleId>,
  now: DayJs,
): Either<string, Reminder> =>
  pipe(
    Either.right({
      createdBy: DiscordUserId.fromUser(interaction.user),
      who,
    }),
    Either.apS(
      'when',
      pipe(
        parseWhen(now, interaction.options.getString(Keys.when)),
        Either.fromOption(() => 'Durée ou date invalide'),
        Either.filterOrElse(
          when => ord.lt(DayJs.Ord)(now, when),
          () => 'Le rappel ne peut pas être dans le passé',
        ),
      ),
    ),
    Either.apS(
      'what',
      pipe(
        interaction.options.getString(Keys.what),
        Either.fromNullable(`<${Keys.what}> manquant`),
      ),
    ),
  )

const parseWho = (
  nullableGuild: Guild | null,
  nullableRole: Role | APIRole | null,
): Tuple<Maybe<RoleId>, Future<Maybe<Role>>> => {
  const maybeRole = Maybe.fromNullable(nullableRole)
  return Tuple.of(
    pipe(maybeRole, Maybe.map(RoleId.fromRole)),
    pipe(
      apply.sequenceS(Maybe.Apply)({ guild: Maybe.fromNullable(nullableGuild), role: maybeRole }),
      futureMaybe.fromOption,
      futureMaybe.chain(({ guild, role }) =>
        role instanceof Role
          ? Future.right(Maybe.some(role))
          : DiscordConnector.fetchRole(guild, RoleId.fromRole(role)),
      ),
    ),
  )
}

const parseWhen = (now: DayJs, str: string | null): Maybe<DayJs> =>
  str === null
    ? Maybe.none
    : pipe(
        parseDayJs(str),
        Maybe.alt(() => parseMs(now, str)),
        Maybe.map(DayJs.startOf('minute')),
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
