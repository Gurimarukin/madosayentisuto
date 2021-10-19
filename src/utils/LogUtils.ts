import { Guild, Message } from 'discord.js'
import { pipe } from 'fp-ts/function'

import { LogLevel } from '../models/LogLevel'
import { Logger } from '../services/Logger'
import { IO, List, Maybe } from './fp'

const withGuild =
  (logger: Logger, level: LogLevel, guild: Guild) =>
  (...args: List<unknown>): IO<void> =>
    logger[level](`[${guild.name}]`, ...args)

const withAuthor =
  (logger: Logger, level: LogLevel, message: Message) =>
  (...args: List<unknown>): IO<void> => {
    // [guild#channel] user: ...args
    // [guild] user: ...args
    // user: ...args
    const prefix = pipe(
      Maybe.fromNullable(message.guild),
      Maybe.fold(
        () => '',
        guild => {
          // TODO: correct eslint-disable?
          // eslint-disable-next-line @typescript-eslint/no-base-to-string
          const chanName = `#${message.channel.toString()}`
          return `[${guild.name}${chanName}] `
        },
      ),
    )
    return logger[level](`${prefix}${message.author.tag}:`, ...args)
  }

export const LogUtils = { withGuild, withAuthor }
