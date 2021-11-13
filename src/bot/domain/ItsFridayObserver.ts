import type { TextChannel } from 'discord.js'
import { MessageAttachment } from 'discord.js'
import { flow, pipe } from 'fp-ts/function'

import { Future, IO, List, Maybe } from '../../shared/utils/fp'

import { constants } from '../constants'
import { DiscordConnector } from '../helpers/DiscordConnector'
import type { MadEventCronJob } from '../models/events/MadEvent'
import type { LoggerGetter } from '../models/logger/LoggerType'
import type { TObserver } from '../models/rx/TObserver'
import type { GuildStateService } from '../services/GuildStateService'
import { LogUtils } from '../utils/LogUtils'
import { StringUtils } from '../utils/StringUtils'

export const ItsFridayObserver = (
  Logger: LoggerGetter,
  guildStateService: GuildStateService,
): TObserver<MadEventCronJob> => {
  const logger = Logger('ItsFridayObserver')

  return {
    next: () =>
      pipe(
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
      ),
  }

  function sendMessage(c: TextChannel): Future<void> {
    return pipe(
      DiscordConnector.sendMessage(c, {
        content: `C'est vrai.`,
        files: [new MessageAttachment(constants.itsFridayUrl)],
      }),
      Future.map(
        Maybe.fold(
          () =>
            logger.warn(
              `Couldn't send "It's friday" in channel ${LogUtils.format(c.guild, null, c)}`,
            ),
          () => IO.unit,
        ),
      ),
      Future.chain(Future.fromIOEither),
    )
  }
}
