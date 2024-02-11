import type {
  APIRole,
  ChatInputCommandInteraction,
  Guild,
  TextBasedChannel,
  User,
} from 'discord.js'
import { Role } from 'discord.js'
import { apply, ord } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'

import { ChannelId } from '../../../shared/models/ChannelId'
import { DayJs } from '../../../shared/models/DayJs'
import { DiscordUserId } from '../../../shared/models/DiscordUserId'
import { MsDuration } from '../../../shared/models/MsDuration'
import { GuildId } from '../../../shared/models/guild/GuildId'
import { ObserverWithRefinement } from '../../../shared/models/rx/ObserverWithRefinement'
import type { NotUsed } from '../../../shared/utils/fp'
import { Dict, Either, Future, List, Maybe, Tuple } from '../../../shared/utils/fp'
import { futureMaybe } from '../../../shared/utils/futureMaybe'

import { DiscordConnector } from '../../helpers/DiscordConnector'
import { RoleId } from '../../models/RoleId'
import { Command } from '../../models/discord/Command'
import { MadEvent } from '../../models/event/MadEvent'
import type { ReminderWho } from '../../models/scheduledEvent/ReminderWho'
import type { ScheduledEventReminder } from '../../models/scheduledEvent/ScheduledEvent'
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
  isGlobal: true,
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
    if (interaction.isChatInputCommand()) return onChatInputCommand(interaction)
    return Future.notUsed
  })

  function onChatInputCommand(interaction: ChatInputCommandInteraction): Future<NotUsed> {
    switch (interaction.commandName) {
      case Keys.remind:
        return onRemind(interaction)
    }
    return Future.notUsed
  }

  function onRemind(interaction: ChatInputCommandInteraction): Future<NotUsed> {
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
    event: Either<string, ScheduledEventReminder>,
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
                      DayJs.format('DD/MM/YYYY, HH:mm', { locale: true }),
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
  interaction: ChatInputCommandInteraction,
  who: Maybe<ReminderWho>,
  now: DayJs,
): Either<string, ScheduledEventReminder> =>
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
        reminder: { createdBy: DiscordUserId.fromUser(interaction.user), who, what },
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
          ? futureMaybe.some(role)
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

function parseFormat(format: string, str: string): Maybe<DayJs> {
  return pipe(DayJs.of(str, format, { locale: true }), Maybe.fromPredicate(DayJs.isValid))
}

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
