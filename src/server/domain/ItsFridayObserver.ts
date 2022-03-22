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
import type { LoggerGetter } from '../models/logger/LoggerType'
import { ObserverWithRefinement } from '../models/rx/ObserverWithRefinement'
import type { GuildStateService } from '../services/GuildStateService'
import { LogUtils } from '../utils/LogUtils'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const ItsFridayObserver = (Logger: LoggerGetter, guildStateService: GuildStateService) => {
  const logger = Logger('ItsFridayObserver')

  return ObserverWithRefinement.fromNext(
    MadEvent,
    'CronJob',
  )(({ date }) => {
    const isFriday = DayJs.day.get(date) === 5
    return isFriday && DayJs.is8am(date) ? delaySendAllMessages(date) : Future.unit
  })

  function delaySendAllMessages(now: DayJs): Future<void> {
    return pipe(
      randomDelay(now),
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
function randomDelay(now: DayJs): IO<MsDuration> {
  const today2Pm = pipe(now, DayJs.startOf('hour'), DayJs.hour.set(rangeStart))
  const untilToday2Pm = pipe(today2Pm, DayJs.diff(now))
  return pipe(
    random.randomRange(
      MsDuration.unwrap(untilToday2Pm),
      pipe(untilToday2Pm, MsDuration.add(range), MsDuration.unwrap),
    ),
    IO.fromIO,
    IO.filterOrElse(
      n => 0 <= n,
      n =>
        Error(`Got a negative delay until today 2pm: ${StringUtils.prettyMs(MsDuration.wrap(n))}`),
    ),
    IO.map(MsDuration.wrap),
  )
}
