import type { Channel, Guild, User } from 'discord.js'
import { io } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'
import util from 'util'

import { DayJs } from '../../shared/models/DayJs'
import type { LoggerType } from '../../shared/models/LoggerType'
import type { NotUsed } from '../../shared/utils/fp'
import { Either, toNotUsed } from '../../shared/utils/fp'

import { consoleLogFormat } from '../models/logger/observers/ConsoleLogObserver'
import { ChannelUtils } from './ChannelUtils'

/**
 * @deprecated
 */
const __testableFormat =
  (refinement: typeof ChannelUtils.isNamed) =>
  (
    guild: Guild | null = null,
    author: User | null = null,
    channel: Channel | null = null,
  ): string => {
    const chanName = channel !== null && refinement(channel) ? `#${channel.name}` : ''
    const guildAndChan = guild === null ? chanName : `[${guild.name}${chanName}]`
    const authorStr = author !== null ? `${guildAndChan !== '' ? ' ' : ''}${author.tag}:` : ''
    return `${guildAndChan}${authorStr}`
  }

const format = __testableFormat(ChannelUtils.isNamed)

const pretty = (logger: LoggerType, ...args: Parameters<typeof format>): LoggerType => ({
  debug: (...us) => logger.debug(format(...args), ...us),
  info: (...us) => logger.info(format(...args), ...us),
  warn: (...us) => logger.warn(format(...args), ...us),
  error: (...us) => logger.error(format(...args), ...us),
})

const onError =
  (logger: LoggerType) =>
  (e: Error): io.IO<NotUsed> =>
    pipe(
      logger.error(e),
      io.chain(
        Either.fold(
          () =>
            pipe(
              DayJs.now,
              io.map(
                flow(
                  consoleLogFormat('LogUtils', 'error', util.format(e)),
                  console.error,
                  toNotUsed,
                ),
              ),
            ),
          io.of,
        ),
      ),
    )

export const LogUtils = { __testableFormat, format, pretty, onError }
