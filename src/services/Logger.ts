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
  const consoleLog = (level: LogLevel, msg: string): Future<void> =>
    shouldLog(config.logger.consoleLevel, level)
      ? Future.apply(
          () =>
            new Promise<void>(resolve => {
              resolve(console.log(formatConsole(name, level, msg)))
            })
        )
      : Future.unit

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
    IO.runFuture(
      Do(Future.taskEither)
        .do(consoleLog(level, msg))
        .do(discordDMLog(level, msg))
        .return(() => {})
    )

  const debug = (param: any, ...params: any[]) => log('debug', util.format(param, ...params))
  const info = (param: any, ...params: any[]) => log('info', util.format(param, ...params))
  const warn = (param: any, ...params: any[]) => log('warn', util.format(param, ...params))
  const error = (param: any, ...params: any[]) => log('error', util.format(param, ...params))

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
