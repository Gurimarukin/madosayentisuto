import {
  DMChannel,
  Guild,
  Message,
  NewsChannel,
  PartialDMChannel,
  StageChannel,
  TextChannel,
  ThreadChannel,
  User,
  VoiceChannel,
} from 'discord.js'

import { LogLevel } from '../models/LogLevel'
import { Logger } from '../services/Logger'
import { ChannelUtils } from './ChannelUtils'
import { IO, List } from './fp'

const format = (
  guild: Guild | null = null,
  channel:
    | PartialDMChannel
    | DMChannel
    | TextChannel
    | NewsChannel
    | ThreadChannel
    | VoiceChannel
    | StageChannel
    | null = null,
  author: User | null = null,
): string => {
  const chanName =
    channel !== null && ChannelUtils.isNamedChannel(channel) ? `#${channel.name}` : ''
  const guildAndChan = guild === null ? chanName : `[${guild.name}${chanName}]`
  const authorStr = author !== null ? `${guildAndChan !== '' ? ' ' : ''}${author.tag}:` : ''
  return `${guildAndChan}${authorStr}`
}

const withGuild =
  (logger: Logger, level: LogLevel, guild: Guild) =>
  (...args: List<unknown>): IO<void> =>
    logger[level](format(guild), ...args)

const withAuthor =
  (logger: Logger, level: LogLevel, message: Message) =>
  (...args: List<unknown>): IO<void> =>
    logger[level](format(message.guild, message.channel, message.author), ...args)

export const LogUtils = { format, withGuild, withAuthor }
