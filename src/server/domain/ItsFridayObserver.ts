import type { TextChannel } from 'discord.js'
import { MessageAttachment } from 'discord.js'
import { random } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'

import { DayJs } from '../../shared/models/DayJs'
import { MsDuration } from '../../shared/models/MsDuration'
import { StringUtils } from '../../shared/utils/StringUtils'
import { Future, IO, List, Maybe, toUnit } from '../../shared/utils/fp'

import { constants } from '../constants'
import { DiscordConnector } from '../helpers/DiscordConnector'
import { MadEvent } from '../models/event/MadEvent'
import type { LoggerGetter } from '../models/logger/LoggerGetter'
import { ObserverWithRefinement } from '../models/rx/ObserverWithRefinement'
import type { GuildStateService } from '../services/GuildStateService'
import { LogUtils } from '../utils/LogUtils'

const rangeStart = constants.itsFriday.hourRange.start
const rangeEnd = constants.itsFriday.hourRange.end

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const ItsFridayObserver = (Logger: LoggerGetter, guildStateService: GuildStateService) => {
  const logger = Logger('ItsFridayObserver')

  return ObserverWithRefinement.fromNext(
    MadEvent,
    'CronJob',
  )(({ date }) => {
    const isFriday = DayJs.day.get(date) === constants.itsFriday.day
    return isFriday && pipe(date, DayJs.isHourSharp(rangeStart))
      ? delaySendAllMessages(date)
      : Future.unit
  })

  function delaySendAllMessages(now: DayJs): Future<void> {
    return pipe(
      randomDelay(now),
      IO.chainFirst(delay =>
        logger.info(
          `Scheduling "It's friday" at ${pipe(
            now,
            DayJs.add(delay),
            DayJs.format('HH:mm:ss'),
          )} (in ${StringUtils.prettyMs(delay)})`,
        ),
      ),
      Future.fromIOEither,
      Future.chain(delay => pipe(sendAllMessages(), Future.delay(delay))),
    )
  }

  function sendAllMessages(): Future<void> {
    return pipe(
      guildStateService.listAllItsFridayChannels,
      Future.chainFirstIOEitherK(
        flow(
          List.map(c => LogUtils.format(c.guild, null, c)),
          StringUtils.mkString(' '),
          str => logger.info(`Sending "It's friday" in channels: ${str}`),
        ),
      ),
      Future.chain(Future.traverseArray(sendMessage)),
      Future.map(toUnit),
    )
  }

  function sendMessage(channel: TextChannel): Future<void> {
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

const range = MsDuration.hours(rangeEnd - rangeStart)

function randomDelay(now: DayJs): IO<MsDuration> {
  const todayRangeStart = pipe(now, DayJs.startOf('hour'), DayJs.hour.set(rangeStart))
  const untilTodayRangeStart = pipe(todayRangeStart, DayJs.diff(now))
  return pipe(
    random.randomRange(
      MsDuration.unwrap(untilTodayRangeStart),
      pipe(untilTodayRangeStart, MsDuration.add(range), MsDuration.unwrap),
    ),
    IO.fromIO,
    IO.filterOrElse(
      n => 0 <= n,
      n =>
        Error(
          `Got a negative delay until today ${StringUtils.pad10(
            rangeStart,
          )}:00: ${StringUtils.prettyMs(MsDuration.wrap(n))}`,
        ),
    ),
    IO.map(MsDuration.wrap),
  )
}
