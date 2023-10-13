import type {
  BaseMessageOptions,
  GuildMember,
  PartialTextBasedChannelFields,
  Role,
} from 'discord.js'
import { AttachmentBuilder } from 'discord.js'
import { apply } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'

import { DayJs } from '../../shared/models/DayJs'
import type { DiscordUserId } from '../../shared/models/DiscordUserId'
import { ObserverWithRefinement } from '../../shared/models/rx/ObserverWithRefinement'
import { Sink } from '../../shared/models/rx/Sink'
import { TObservable } from '../../shared/models/rx/TObservable'
import type { NotUsed } from '../../shared/utils/fp'
import { Future, IO, List, Maybe, NonEmptyArray, toNotUsed } from '../../shared/utils/fp'
import { futureMaybe } from '../../shared/utils/futureMaybe'

import { constants } from '../config/constants'
import { DiscordConnector } from '../helpers/DiscordConnector'
import { MessageComponent } from '../models/discord/MessageComponent'
import { MadEvent } from '../models/event/MadEvent'
import type { LoggerGetter } from '../models/logger/LoggerObservable'
import type { ReminderWho } from '../models/scheduledEvent/ReminderWho'
import type {
  ScheduledEventItsFriday,
  ScheduledEventReminder,
} from '../models/scheduledEvent/ScheduledEvent'
import { ScheduledEvent } from '../models/scheduledEvent/ScheduledEvent'
import type { GuildStateService } from '../services/GuildStateService'
import type { ScheduledEventService } from '../services/ScheduledEventService'
import type { GuildSendableChannel } from '../utils/ChannelUtils'
import { ChannelUtils } from '../utils/ChannelUtils'
import { LogUtils } from '../utils/LogUtils'

const { cdnBase } = constants

const itsFriday = {
  videoUrl: `${cdnBase}/cestvrai.mp4`,
  // PeerTube:  https://tube.fede.re/w/gAfpve8szQ5TtiPfRqkNEi
  // thumbnail: ${cdnBase}/cestvrai-thumbnail.png
}

type ReminderWhoParsed = {
  role: Role
  author: GuildMember
  channel: PartialTextBasedChannelFields
}

export const ScheduledEventObserver = (
  Logger: LoggerGetter,
  discord: DiscordConnector,
  scheduledEventService: ScheduledEventService,
  guildStateService: GuildStateService,
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
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
        count === 0 ? IO.notUsed : logger.info(`Sent ${count} scheduled events`),
      ),
    ),
  )

  function onScheduledEvent(now: DayJs, event: ScheduledEvent): Future<NotUsed> {
    switch (event.type) {
      case 'Reminder':
        return onReminder(now, event)
      case 'ItsFriday':
        return onItsFriday(now, event)
    }
  }

  function onReminder(now: DayJs, event: ScheduledEventReminder): Future<NotUsed> {
    const eventStr = JSON.stringify(ScheduledEvent.codec.encode(event))
    const {
      scheduledAt,
      reminder: { createdBy, who, what },
    } = event
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
                    reminderMessage({ now, scheduledAt, what, r: Maybe.none }),
                  ),
                ),
              ),
            flow(
              parseWho(createdBy),
              futureMaybe.chain(({ role, author, channel }) =>
                DiscordConnector.sendMessage(
                  channel,
                  reminderMessage({ now, scheduledAt, what, r: Maybe.some({ role, author }) }),
                ),
              ),
            ),
          ),
        ),
      ),
      Future.chainIOEitherK(
        Maybe.fold(
          () => logger.warn(`Failed to send reminder: ${eventStr}`),
          () => IO.notUsed,
        ),
      ),
    )
  }

  function parseWho(
    createdBy: DiscordUserId,
  ): (who: ReminderWho) => Future<Maybe<ReminderWhoParsed>> {
    return who =>
      pipe(
        discord.getGuild(who.guild),
        Future.fromIOEither,
        futureMaybe.chain(guild =>
          apply.sequenceS(futureMaybe.ApplyPar)({
            role: DiscordConnector.fetchRole(guild, who.role),
            author: DiscordConnector.fetchMember(guild, createdBy),
            channel: pipe(
              discord.fetchChannel(who.channel),
              futureMaybe.filter(ChannelUtils.isGuildSendable),
            ),
          }),
        ),
      )
  }

  function onItsFriday(now: DayJs, event: ScheduledEventItsFriday): Future<NotUsed> {
    const nowStartOfDay = pipe(now, DayJs.startOf('day'))
    const scheduledAtStartOfDay = pipe(event.scheduledAt, DayJs.startOf('day'))
    return DayJs.Eq.equals(nowStartOfDay, scheduledAtStartOfDay)
      ? pipe(
          guildStateService.listAllItsFridayChannels,
          Future.chainFirstIOEitherK(
            flow(
              List.map(c => LogUtils.format(c.guild, null, c)),
              List.mkString(' '),
              str => logger.info(`Sending "It's friday" in channels: ${str}`),
            ),
          ),
          Future.chain(List.traverse(Future.ApplicativePar)(sendItsFridayMessage)),
          Future.map(toNotUsed),
        )
      : Future.fromIOEither(
          logger.warn(
            `Missed "It's friday", now: ${DayJs.toISOString(now)}, scheduledAt: ${DayJs.toISOString(
              event.scheduledAt,
            )}`,
          ),
        )
  }

  function sendItsFridayMessage(channel: GuildSendableChannel): Future<NotUsed> {
    return pipe(
      DiscordConnector.sendMessage(channel, {
        content: `C'est vrai.`,
        files: [new AttachmentBuilder(itsFriday.videoUrl)],
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
          () => IO.notUsed,
        ),
      ),
    )
  }
}

type ReminderMessage = {
  now: DayJs
  scheduledAt: DayJs
  what: string
  r: Maybe<{
    role: Role
    author: GuildMember
  }>
}

const reminderMessage = ({ now, scheduledAt, what, r }: ReminderMessage): BaseMessageOptions => {
  const authorStr = pipe(
    r,
    Maybe.map(({ author }) => `*Créé par ${author}*`),
  )
  const initialyScheduledAt = DayJs.Eq.equals(scheduledAt, now)
    ? Maybe.none
    : Maybe.some(
        `*Initialement prévu le ${pipe(
          scheduledAt,
          DayJs.format('DD/MM/YYYY, HH:mm', { locale: true }),
        )}*`,
      )
  return {
    content: pipe(
      r,
      Maybe.map(({ role }) => `${role}`),
      Maybe.toUndefined,
    ),
    embeds: [
      MessageComponent.safeEmbed({
        color: constants.messagesColor,
        fields: [
          MessageComponent.field(
            'Rappel',
            pipe(
              [
                Maybe.some(what),
                pipe(
                  [authorStr, initialyScheduledAt],
                  List.compact,
                  NonEmptyArray.fromReadonlyArray,
                  Maybe.map(List.mkString('\n')),
                ),
              ],
              List.compact,
              List.mkString('\n\n'),
            ),
          ),
        ],
      }),
    ],
  }
}
