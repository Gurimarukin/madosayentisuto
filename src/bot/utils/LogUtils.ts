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

import type { IO, List } from 'shared/utils/fp'

import type { LogLevel } from 'bot/models/logger/LogLevel'
import type { LoggerType } from 'bot/models/logger/LoggerType'
import { ChannelUtils } from 'bot/utils/ChannelUtils'

type Chan =
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
  (guild: Guild | null = null, author: User | null = null, channel: Chan | null = null): string => {
    const chanName = channel !== null && refinement(channel) ? `#${channel.name}` : ''
    const guildAndChan = guild === null ? chanName : `[${guild.name}${chanName}]`
    const authorStr = author !== null ? `${guildAndChan !== '' ? ' ' : ''}${author.tag}:` : ''
    return `${guildAndChan}${authorStr}`
  }

const format = __testableFormat(ChannelUtils.isNamedChannel)

const pretty =
  (logger: LoggerType, ...args: Parameters<typeof format>) =>
  (level: LogLevel, ...us: List<unknown>): IO<void> =>
    logger[level](format(...args), ...us)

export const LogUtils = { __testableFormat, format, pretty }
