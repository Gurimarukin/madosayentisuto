import util from 'util'

import type { Config } from 'bot/Config'
import { DiscordConnector } from 'bot/helpers/DiscordConnector'
import type { LoggerGetter } from 'bot/models/logger/LoggerType'
import { LogLevel, LogLevelOrOff } from 'bot/models/logger/LogLevel'
import type { MessageOptions } from 'discord.js'
import { MessageEmbed } from 'discord.js'
import { pipe } from 'fp-ts/function'
import type { List } from 'shared/utils/fp'
import { Future, IO, Maybe } from 'shared/utils/fp'

export const DiscordLogger =
  (config: Config, discord: DiscordConnector): LoggerGetter =>
  name => {
    const consoleLog = (level: LogLevel, msg: string): Future<void> =>
      shouldLog(config.logger.consoleLevel, level)
        ? Future.tryCatch(
            () =>
              new Promise<void>(resolve => {
                // eslint-disable-next-line functional/no-expression-statement
                resolve(console.log(formatConsole(name, level, msg)))
              }),
          )
        : Future.unit

    const discordDMLog = (level: LogLevel, rawMsg: string): Future<void> => {
      if (shouldLog(config.logger.discordDM.level, level)) {
        const msg: string | MessageOptions = config.logger.discordDM.compact
          ? formatDMCompact(name, level, rawMsg)
          : formatDMEmbed(name, level, rawMsg)

        const futures = config.admins.map(userId =>
          pipe(
            discord.fetchUser(userId),
            Future.chain(
              Maybe.fold(
                () => Future.unit,
                user =>
                  pipe(
                    DiscordConnector.sendMessage(user, msg),
                    Future.map(
                      Maybe.fold(
                        () => {}, // TODO: what to do if message wasn't sent?
                        () => {},
                      ),
                    ),
                  ),
              ),
            ),
          ),
        )

        return pipe(
          Future.sequenceArray(futures),
          Future.map(() => {}),
        )
      } else {
        return Future.unit
      }
    }

    const log = (level: LogLevel, msg: string): IO<void> =>
      IO.runFuture(
        pipe(
          consoleLog(level, msg),
          Future.chain(() => discordDMLog(level, msg)),
        ),
      )

    const debug = (param: unknown, ...params: List<unknown>): IO<void> =>
      log('debug', util.format(param, ...params))
    const info = (param: unknown, ...params: List<unknown>): IO<void> =>
      log('info', util.format(param, ...params))
    const warn = (param: unknown, ...params: List<unknown>): IO<void> =>
      log('warn', util.format(param, ...params))
    const error = (param: unknown, ...params: List<unknown>): IO<void> =>
      log('error', util.format(param, ...params))

    return { debug, info, warn, error }
  }

const shouldLog = (setLevel: LogLevelOrOff, level: LogLevel): boolean =>
  LogLevelOrOff.value[setLevel] >= LogLevelOrOff.value[level]

const formatConsole = (name: string, level: LogLevel, msg: string): string => {
  const withName = `${name} - ${msg}`
  const withTimestamp = `${color(formatDate(new Date()), '30;1')} ${withName}` // fp-ts date.now
  const c = LogLevel.shellColor[level]
  return level === 'info' || level === 'warn'
    ? `${color(level.toUpperCase(), c)}  ${withTimestamp}`
    : `${color(level.toUpperCase(), c)} ${withTimestamp}`
}

const formatDMCompact = (name: string, level: LogLevel, msg: string): string => {
  const withName = `${name} - ${msg}`
  return level === 'info' || level === 'warn'
    ? `\`${level.toUpperCase()}  ${withName}\``
    : `\`${level.toUpperCase()} ${withName}\``
}

const formatDMEmbed = (name: string, level: LogLevel, msg: string): MessageOptions => ({
  embeds: [
    new MessageEmbed().setColor(LogLevel.hexColor[level]).setDescription(`${name} - ${msg}`),
  ],
})

const formatDate = (d: Date): string => {
  const year = d.getFullYear()
  const month = pad10(d.getMonth() + 1)
  const day = pad10(d.getDate())
  const hours = pad10(d.getHours())
  const minutes = pad10(d.getMinutes())
  const seconds = pad10(d.getSeconds())
  return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`
}

const pad10 = (n: number): string => (n < 10 ? `0${n}` : n.toString())

const color = (s: string, c: string): string => (process.stdout.isTTY ? `\x1B[${c}m${s}\x1B[0m` : s)
