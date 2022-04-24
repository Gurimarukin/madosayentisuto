import type {
  Guild,
  MessageOptions,
  PartialTextBasedChannelFields,
  Role,
  TextChannel,
} from 'discord.js'
import { MessageAttachment } from 'discord.js'
import { apply } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'

import { DayJs } from '../../shared/models/DayJs'
import { StringUtils } from '../../shared/utils/StringUtils'
import { Future, IO, List, toUnit } from '../../shared/utils/fp'
import { Maybe } from '../../shared/utils/fp'
import { futureMaybe } from '../../shared/utils/futureMaybe'

import { constants } from '../constants'
import { DiscordConnector } from '../helpers/DiscordConnector'
import { MadEvent } from '../models/event/MadEvent'
import type { LoggerGetter } from '../models/logger/LoggerGetter'
import { ObserverWithRefinement } from '../models/rx/ObserverWithRefinement'
import { Sink } from '../models/rx/Sink'
import { TObservable } from '../models/rx/TObservable'
import type { Reminder } from '../models/scheduledEvent/Reminder'
import type { ReminderWho } from '../models/scheduledEvent/ReminderWho'
import { ScheduledEvent } from '../models/scheduledEvent/ScheduledEvent'
import type { GuildStateService } from '../services/GuildStateService'
import type { ScheduledEventService } from '../services/ScheduledEventService'
import { ChannelUtils } from '../utils/ChannelUtils'
import { LogUtils } from '../utils/LogUtils'
import { MessageUtils } from '../utils/MessageUtils'

type ReminderWhoParsed = {
  readonly guild: Guild
  readonly role: Role
  readonly channel: PartialTextBasedChannelFields
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const ScheduledEventObserver = (
  Logger: LoggerGetter,
  discord: DiscordConnector,
  scheduledEventService: ScheduledEventService,
  guildStateService: GuildStateService,
) => {
  const logger = Logger('ScheduledEventObserver')

  return ObserverWithRefinement.fromNext(
    MadEvent,
    'CronJob',
  )(({ date }) =>
    pipe(
      scheduledEventService.listBeforeDate(date),
      TObservable.chainTaskEitherK(event =>
        pipe(
          onScheduledEvent(date, event),
          Future.map(() => event._id),
        ),
      ),
      TObservable.chunksOf(50),
      TObservable.chainTaskEitherK(scheduledEventService.removeByIds),
      Sink.reduce(0, (acc, n) => acc + n),
      Future.chainIOEitherK(count =>
        count === 0 ? IO.unit : logger.info(`Sent ${count} scheduled events`),
      ),
    ),
  )

  function onScheduledEvent(now: DayJs, event: ScheduledEvent): Future<void> {
    switch (event.type) {
      case 'Reminder':
        return onReminder(now, event, event.reminder)
      case 'ItsFriday':
        return onItsFriday(now, event)
    }
  }

  function onReminder(
    now: DayJs,
    event: ScheduledEvent,
    { createdBy, who, what }: Reminder,
  ): Future<void> {
    const eventStr = JSON.stringify(ScheduledEvent.codec.encode(event))
    const { scheduledAt } = event
    return pipe(
      logger.debug(`Sending reminder: ${eventStr}`),
      Future.fromIOEither,
      Future.chain(() =>
        pipe(
          who,
          Maybe.fold(
            () =>
              pipe(
                discord.fetchUser(createdBy),
                futureMaybe.chain(user =>
                  DiscordConnector.sendMessage(
                    user,
                    reminderMessage({ now, scheduledAt, what, role: Maybe.none }),
                  ),
                ),
              ),
            flow(
              parseWho,
              futureMaybe.chain(({ role, channel }) =>
                DiscordConnector.sendMessage(
                  channel,
                  reminderMessage({ now, scheduledAt, what, role: Maybe.some(role) }),
                ),
              ),
            ),
          ),
        ),
      ),
      Future.chainIOEitherK(
        Maybe.fold(
          () => logger.warn(`Failed to send reminder: ${eventStr}`),
          () => IO.unit,
        ),
      ),
    )
  }

  function parseWho(who: ReminderWho): Future<Maybe<ReminderWhoParsed>> {
    return pipe(
      apply.sequenceS(futureMaybe.ApplyPar)({
        guild: Future.fromIOEither(discord.getGuild(who.guild)),
        channel: pipe(
          discord.fetchChannel(who.channel),
          futureMaybe.filter(ChannelUtils.isBaseGuildTextChannel),
        ),
      }),
      futureMaybe.bind('role', ({ guild }) => DiscordConnector.fetchRole(guild, who.role)),
    )
  }

  function onItsFriday(now: DayJs, event: ScheduledEvent): Future<void> {
    if (
      !DayJs.Eq.equals(
        pipe(now, DayJs.startOf('day')),
        pipe(event.scheduledAt, DayJs.startOf('day')),
      )
    ) {
      return Future.fromIOEither(
        logger.warn(`Missed "It's friday": ${DayJs.toISOString(event.scheduledAt)}`),
      )
    }
    return pipe(
      guildStateService.listAllItsFridayChannels,
      Future.chainFirstIOEitherK(
        flow(
          List.map(c => LogUtils.format(c.guild, null, c)),
          StringUtils.mkString(' '),
          str => logger.info(`Sending "It's friday" in channels: ${str}`),
        ),
      ),
      Future.chain(Future.traverseArray(sendItsFridayMessage)),
      Future.map(toUnit),
    )
  }

  function sendItsFridayMessage(channel: TextChannel): Future<void> {
    return pipe(
      DiscordConnector.sendMessage(channel, {
        content: `C'est vrai.`,
        files: [new MessageAttachment(constants.itsFridayUrl)],
      }),
      Future.chainIOEitherK(
        Maybe.fold(
          () =>
            logger.warn(
              `Couldn't send "It's friday" in channel ${LogUtils.format(
                channel.guild,
                null,
                channel,
              )}`,
            ),
          () => IO.unit,
        ),
      ),
    )
  }
}

type ReminderMessage = {
  readonly now: DayJs
  readonly scheduledAt: DayJs
  readonly what: string
  readonly role: Maybe<Role>
}

const reminderMessage = ({ now, scheduledAt, what, role }: ReminderMessage): MessageOptions => {
  const initialyScheduledAt = DayJs.Eq.equals(scheduledAt, now)
    ? ''
    : `\n\n*Initialement prévu le : ${pipe(scheduledAt, DayJs.format('DD/MM/YYYY, HH:mm'))}*`
  return {
    content: pipe(
      role,
      Maybe.map(r => `${r}`),
      Maybe.toUndefined,
    ),
    embeds: [
      MessageUtils.safeEmbed({
        color: constants.messagesColor,
        fields: [MessageUtils.field('Rappel', `${what}${initialyScheduledAt}`)],
      }),
    ],
  }
}
