import type { Channel, Guild, User } from 'discord.js'

import type { LoggerType } from '../../shared/models/LoggerType'

import { ChannelUtils } from './ChannelUtils'

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
  trace: (...us) => logger.trace(format(...args), ...us),
  debug: (...us) => logger.debug(format(...args), ...us),
  info: (...us) => logger.info(format(...args), ...us),
  warn: (...us) => logger.warn(format(...args), ...us),
  error: (...us) => logger.error(format(...args), ...us),
})

export const LogUtils = {
  format,
  pretty,
  /**
   * @deprecated
   */
  // eslint-disable-next-line deprecation/deprecation
  __testableFormat,
}
