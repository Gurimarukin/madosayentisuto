import util from 'util'
import fmt from 'dateformat'
import { UserManager, MessageEmbed, StringResolvable } from 'discord.js'

import { LoggerConfig } from '../config/Config'
import { TSnowflake } from '../models/TSnowflake'
import { LogLevel, LogLevelOrOff } from '../models/LogLevel'
import { Do, IO, Future, pipe } from '../utils/fp'

export type Logger = Record<LogLevel, (arg: any, ...args: any[]) => IO<void>>

export type PartialLogger = (name: string) => Logger

export const PartialLogger = (
  config: LoggerConfig,
  userManager: UserManager
): PartialLogger => name => {
  const consoleLog = (level: LogLevel, msg: string): IO<void> =>
    shouldLog(config.consoleLevel, level)
      ? IO.apply(() => console.log(formatConsole(name, level, msg)))
      : IO.right(undefined)

  const discordDMLog = (level: LogLevel, rawMsg: string): Future<void> => {
    if (shouldLog(config.discordDM.level, level)) {
      const msg: StringResolvable = config.discordDM.compact
        ? formatDMCompact(name, level, rawMsg)
        : formatDMEmbed(name, level, rawMsg)

      const futures = config.discordDM.users.map(userId =>
        Do(Future.taskEither)
          .bind(
            'user',
            Future.apply(() => userManager.fetch(TSnowflake.unwrap(userId)))
          )
          .bindL('channel', ({ user }) => Future.apply(() => user.createDM()))
          .bindL('_', ({ channel }) => Future.apply(() => channel.send(msg)))
          .return(() => {})
      )

      return pipe(
        Future.parallel(futures),
        Future.map(_ => {})
      )
    } else {
      return Future.unit
    }
  }

  const log = (level: LogLevel, msg: string): IO<void> =>
    Do(IO.ioEither)
      .bind('_1', consoleLog(level, msg))
      .bind('_2', IO.runFuture(discordDMLog(level, msg)))
      .return(() => {})

  const debug = (format: any, ...param: any[]) => log('debug', util.format(format, ...param))
  const info = (format: any, ...param: any[]) => log('info', util.format(format, ...param))
  const warn = (format: any, ...param: any[]) => log('warn', util.format(format, ...param))
  const error = (format: any, ...param: any[]) => log('error', util.format(format, ...param))

  return { debug, info, warn, error }
}

function shouldLog(setLevel: LogLevelOrOff, level: LogLevel): boolean {
  return LogLevelOrOff.value[setLevel] >= LogLevelOrOff.value[level]
}

function formatConsole(name: string, level: LogLevel, msg: string): string {
  const withName = `${name} - ${msg}`
  const withTimestamp = `${color(fmt('yyyy/mm/dd HH:MM:ss'), '30;1')} ${withName}`
  const c = LogLevel.shellColor[level]
  return level === 'info' || level === 'warn'
    ? `[${color(level.toUpperCase(), c)}]  ${withTimestamp}`
    : `[${color(level.toUpperCase(), c)}] ${withTimestamp}`
}

function formatDMCompact(name: string, level: LogLevel, msg: string): string {
  const withName = `${name} - ${msg}`
  return level === 'info' || level === 'warn'
    ? `\`[${level.toUpperCase()}]  ${withName}\``
    : `\`[${level.toUpperCase()}] ${withName}\``
}

function formatDMEmbed(name: string, level: LogLevel, msg: string): MessageEmbed {
  return new MessageEmbed().setColor(LogLevel.hexColor[level]).setDescription(`${name} - ${msg}`)
}

function color(s: string, c: string): string {
  return process.stdout.isTTY ? `\x1B[${c}m${s}\x1B[0m` : s
}
