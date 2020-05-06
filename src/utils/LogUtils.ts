import { Guild, Message } from 'discord.js'

import { IO, pipe, Maybe } from './fp'
import { LogLevel } from '../models/LogLevel'
import { Logger } from '../services/Logger'

export namespace LogUtils {
  export const withGuild = (logger: Logger, level: LogLevel, guild: Guild) => (
    ...args: any[]
  ): IO<void> => logger[level](`[${guild.name}]`, ...args)

  export const withAuthor = (logger: Logger, level: LogLevel, message: Message) => (
    ...args: any[]
  ): IO<void> => {
    // [guild#channel] user: ...args
    // [guild] user: ...args
    // user: ...args
    const prefix = pipe(
      Maybe.fromNullable(message.guild),
      Maybe.fold(
        () => '',
        guild => {
          const chanName = message.channel.type === 'text' ? `#${message.channel.name}` : ''
          return `[${guild.name}${chanName}] `
        }
      )
    )
    return logger[level](`${prefix}${message.author.tag}:`, ...args)
  }
}
