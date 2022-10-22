import type { Channel, Guild, User } from 'discord.js'
import { io } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'
import util from 'util'

import { consoleLogFormat } from '../../server/models/logger/observers/ConsoleLogObserver'
import { ChannelUtils } from '../../server/utils/ChannelUtils'

import { DayJs } from '../models/DayJs'
import type { LoggerType } from '../models/LoggerType'
import type { NotUsed } from './fp'
import { Either, toNotUsed } from './fp'

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
    pipe(logger.error(e), io.chain(Either.fold(() => onErrorConsole(e), io.of)))

const onErrorConsole = (e: Error): io.IO<NotUsed> =>
  pipe(
    DayJs.now,
    io.map(flow(consoleLogFormat('LogUtils', 'error', util.format(e)), console.error, toNotUsed)),
  )

export const LogUtils = {
  format,
  pretty,
  onError,
  onErrorConsole,
  /**
   * @deprecated
   */
  __testableFormat,
}
