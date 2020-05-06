import util from 'util'
import fmt from 'dateformat'
import { MessageEmbed, StringResolvable } from 'discord.js'

import { DiscordConnector } from './DiscordConnector'
import { Config } from '../config/Config'
import { LogLevel, LogLevelOrOff } from '../models/LogLevel'
import { Do, IO, Future, pipe, Maybe } from '../utils/fp'

export type Logger = Record<LogLevel, (arg: any, ...args: any[]) => IO<void>>

export type PartialLogger = (name: string) => Logger

export const PartialLogger = (config: Config, discord: DiscordConnector): PartialLogger => name => {
  const consoleLog = (level: LogLevel, msg: string): IO<void> =>
    shouldLog(config.logger.consoleLevel, level)
      ? IO.apply(() => console.log(formatConsole(name, level, msg)))
      : IO.right(undefined)

  const discordDMLog = (level: LogLevel, rawMsg: string): Future<void> => {
    if (shouldLog(config.logger.discordDM.level, level)) {
      const msg: StringResolvable = config.logger.discordDM.compact
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
                  Future.apply(() => user.createDM()),
                  Future.chain(_ => Future.apply(() => _.send(msg))),
                  Future.map(_ => {})
                )
            )
          )
        )
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
      .do(consoleLog(level, msg))
      .do(IO.runFuture(discordDMLog(level, msg)))
      .return(() => {})

  const debug = (format: any, ...param: any[]) => log('debug', util.format(format, ...param))
  const info = (format: any, ...param: any[]) => log('info', util.format(format, ...param))
  const warn = (format: any, ...param: any[]) => log('warn', util.format(format, ...param))
  const error = (format: any, ...param: any[]) => log('error', util.format(format, ...param))

  return { debug, info, warn, error }
}

const shouldLog = (setLevel: LogLevelOrOff, level: LogLevel): boolean =>
  LogLevelOrOff.value[setLevel] >= LogLevelOrOff.value[level]

const formatConsole = (name: string, level: LogLevel, msg: string): string => {
  const withName = `${name} - ${msg}`
  const withTimestamp = `${color(fmt('yyyy/mm/dd HH:MM:ss'), '30;1')} ${withName}`
  const c = LogLevel.shellColor[level]
  return level === 'info' || level === 'warn'
    ? `[${color(level.toUpperCase(), c)}]  ${withTimestamp}`
    : `[${color(level.toUpperCase(), c)}] ${withTimestamp}`
}

const formatDMCompact = (name: string, level: LogLevel, msg: string): string => {
  const withName = `${name} - ${msg}`
  return level === 'info' || level === 'warn'
    ? `\`[${level.toUpperCase()}]  ${withName}\``
    : `\`[${level.toUpperCase()}] ${withName}\``
}

const formatDMEmbed = (name: string, level: LogLevel, msg: string): MessageEmbed =>
  new MessageEmbed().setColor(LogLevel.hexColor[level]).setDescription(`${name} - ${msg}`)

const color = (s: string, c: string): string => (process.stdout.isTTY ? `\x1B[${c}m${s}\x1B[0m` : s)
