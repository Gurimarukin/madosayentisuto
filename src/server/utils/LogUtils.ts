import type {
  DMChannel,
  Guild,
  NewsChannel,
  PartialDMChannel,
  StageChannel,
  TextChannel,
  ThreadChannel,
  User,
  VoiceChannel,
} from 'discord.js'

import type { LoggerType } from '../../shared/models/LoggerType'

import { ChannelUtils } from './ChannelUtils'

export type LoggableChannel =
  | PartialDMChannel
  | DMChannel
  | TextChannel
  | NewsChannel
  | ThreadChannel
  | VoiceChannel
  | StageChannel

/**
 * @deprecated
 */
const __testableFormat =
  (refinement: typeof ChannelUtils.isNamedChannel) =>
  (
    guild: Guild | null = null,
    author: User | null = null,
    channel: LoggableChannel | null = null,
  ): string => {
    const chanName = channel !== null && refinement(channel) ? `#${channel.name}` : ''
    const guildAndChan = guild === null ? chanName : `[${guild.name}${chanName}]`
    const authorStr = author !== null ? `${guildAndChan !== '' ? ' ' : ''}${author.tag}:` : ''
    return `${guildAndChan}${authorStr}`
  }

const format = __testableFormat(ChannelUtils.isNamedChannel)

const pretty = (logger: LoggerType, ...args: Parameters<typeof format>): LoggerType => ({
  debug: (...us) => logger.debug(format(...args), ...us),
  info: (...us) => logger.info(format(...args), ...us),
  warn: (...us) => logger.warn(format(...args), ...us),
  error: (...us) => logger.error(format(...args), ...us),
})

export const LogUtils = { __testableFormat, format, pretty }
