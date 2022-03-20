import type { Dayjs } from 'dayjs'
import type { TextChannel } from 'discord.js'
import { MessageAttachment } from 'discord.js'
import { random } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'

import { MsDuration } from '../../shared/models/MsDuration'
import { DateUtils } from '../../shared/utils/DateUtils'
import { StringUtils } from '../../shared/utils/StringUtils'
import { Future, IO, List, Maybe } from '../../shared/utils/fp'

import { constants } from '../constants'
import { DiscordConnector } from '../helpers/DiscordConnector'
import type { MadEventCronJob } from '../models/events/MadEvent'
import type { LoggerGetter } from '../models/logger/LoggerType'
import type { TObserver } from '../models/rx/TObserver'
import type { GuildStateService } from '../services/GuildStateService'
import { LogUtils } from '../utils/LogUtils'

export const ItsFridayObserver = (
  Logger: LoggerGetter,
  guildStateService: GuildStateService,
): TObserver<MadEventCronJob> => {
  const logger = Logger('ItsFridayObserver')

  return {
    next: ({ date }) => {
      const isFriday = date.day() === 5
      return isFriday && DateUtils.is8am(date) ? delaySendAllMessages(date) : Future.unit
    },
  }

  function delaySendAllMessages(now: Dayjs): Future<void> {
    return pipe(
      randomDelay(now),
      Future.fromIOEither,
      Future.chain(delay => pipe(sendAllMessages(), Future.delay(delay))),
    )
  }

  function sendAllMessages(): Future<void> {
    return pipe(
      guildStateService.findAllItsFridayChannels(),
      Future.chainFirstIOEitherK(
        flow(
          List.map(c => LogUtils.format(c.guild, null, c)),
          StringUtils.mkString(' '),
          str => logger.info(`Sending "It's friday" in channels: ${str}`),
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
function randomDelay(now: Dayjs): IO<MsDuration> {
  const today2Pm = now.startOf('hour').hour(rangeStart)
  const untilToday2Pm = pipe(today2Pm, DateUtils.diff(now))
  return pipe(
    random.randomRange(
      MsDuration.unwrap(untilToday2Pm),
      pipe(untilToday2Pm, MsDuration.add(range), MsDuration.unwrap),
    ),
    IO.fromIO,
    IO.map(MsDuration.wrap),
    IO.filterOrElse(
      n => 0 <= MsDuration.unwrap(n),
      n => Error(`Got a negative delay until today 2pm: ${StringUtils.prettyMs(n)}`),
    ),
  )
}
