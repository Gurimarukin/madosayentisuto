import type { TextChannel } from 'discord.js'
import { MessageAttachment } from 'discord.js'
import { date, random } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'

import { MsDuration } from '../../shared/models/MsDuration'
import { StringUtils } from '../../shared/utils/StringUtils'
import { Future, IO, List, Maybe } from '../../shared/utils/fp'

import { constants } from '../constants'
import { DiscordConnector } from '../helpers/DiscordConnector'
import type { MadEventCronJob } from '../models/events/MadEvent'
import type { LoggerGetter } from '../models/logger/LoggerType'
import type { TObserver } from '../models/rx/TObserver'
import type { GuildStateService } from '../services/GuildStateService'
import { DateUtils } from '../utils/DateUtils'
import { LogUtils } from '../utils/LogUtils'

export const ItsFridayObserver = (
  Logger: LoggerGetter,
  guildStateService: GuildStateService,
): TObserver<MadEventCronJob> => {
  const logger = Logger('ItsFridayObserver')

  return {
    next: () =>
      pipe(
        date.create,
        Future.fromIO,
        Future.chain(now => {
          const isFriday = now.getDay() === 5
          return isFriday ? delaySendAllMessages(now) : Future.unit
        }),
      ),
  }

  function delaySendAllMessages(now: Date): Future<void> {
    return pipe(
      randomDelay(now),
      Future.fromIOEither,
      Future.chain(delay => pipe(sendAllMessages(), Future.delay(delay))),
    )
  }

  function sendAllMessages(): Future<void> {
    return pipe(
      guildStateService.findAllItsFridayChannels(),
      Future.chainFirst(
        flow(
          List.map(c => LogUtils.format(c.guild, null, c)),
          StringUtils.mkString(' '),
          str => logger.debug(`Sending "It's friday" in channels: ${str}`),
          Future.fromIOEither,
        ),
      ),
      Future.chain(Future.traverseArray(sendMessage)),
      Future.map(() => {}),
    )
  }

  function sendMessage(channel: TextChannel): Future<void> {
    return pipe(
      DiscordConnector.sendMessage(channel, {
        content: `C'est vrai.`,
        files: [new MessageAttachment(constants.itsFridayUrl)],
      }),
      Future.map(
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
      Future.chain(Future.fromIOEither),
    )
  }
}

const rangeStart = 14
const rangeEnd = 17
const range = MsDuration.hours(rangeEnd - rangeStart)
function randomDelay(now: Date): IO<MsDuration> {
  const today2Pm = new Date(now.getFullYear(), now.getMonth(), now.getDate(), rangeStart, 0, 0, 0)
  const untilToday2Pm = pipe(
    today2Pm,
    DateUtils.minusDuration(MsDuration.fromDate(now)),
    MsDuration.fromDate,
  )
  return pipe(
    random.randomRange(
      MsDuration.unwrap(untilToday2Pm),
      pipe(untilToday2Pm, MsDuration.add(range), MsDuration.unwrap),
    ),
    IO.fromIO,
    IO.map(MsDuration.wrap),
    IO.filterOrElse(
      n => 0 <= MsDuration.unwrap(n),
      n => Error(`Got a negative delay until today, 2 pm: ${StringUtils.prettyMs(n)}`),
    ),
  )
}
