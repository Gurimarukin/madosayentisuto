import * as t from 'io-ts'
import { sequenceT } from 'fp-ts/lib/Apply'
import { nonEmptyArray } from 'io-ts-types/lib/nonEmptyArray'

import { ConfReader, ValidatedNea } from './ConfReader'
import { LogLevelOrOff } from '../models/LogLevel'
import { TSnowflake } from '../models/TSnowflake'
import { IO, pipe, Either, NonEmptyArray } from '../utils/fp'

export interface Config {
  readonly clientSecret: string
  readonly admins: NonEmptyArray<TSnowflake>
  readonly cmdPrefix: string
  readonly logger: LoggerConfig
  readonly db: DbConfig
}
export function Config(
  clientSecret: string,
  admins: NonEmptyArray<TSnowflake>,
  cmdPrefix: string,
  logger: LoggerConfig,
  db: DbConfig
): Config {
  return { clientSecret, admins, cmdPrefix, logger, db }
}

export namespace Config {
  export function load(): IO<Config> {
    return pipe(
      ConfReader.fromFiles('./conf/local.conf.json', './conf/application.conf.json'),
      IO.chain(reader =>
        pipe(
          readConfig(reader),
          Either.mapLeft(errors => new Error(`Errors while reading config:\n${errors.join('\n')}`)),
          IO.fromEither
        )
      )
    )
  }
}

function readConfig(reader: ConfReader): ValidatedNea<Config> {
  return pipe(
    sequenceT(Either.getValidation(NonEmptyArray.getSemigroup<string>()))(
      reader(t.string)('clientSecret'),
      reader(nonEmptyArray(TSnowflake.codec))('admins'),
      reader(t.string)('cmdPrefix'),
      readLoggerConfig(reader),
      readDbConfig(reader)
    ),
    Either.map(_ => Config(..._))
  )
}

/**
 * LoggerConfig
 */

export interface LoggerConfig {
  readonly consoleLevel: LogLevelOrOff
  readonly discordDM: {
    readonly level: LogLevelOrOff
    readonly compact: boolean
  }
}
export function LoggerConfig(
  consoleLevel: LogLevelOrOff,
  discordDMlevel: LogLevelOrOff,
  discordDMCompact: boolean
): LoggerConfig {
  return {
    consoleLevel,
    discordDM: { level: discordDMlevel, compact: discordDMCompact }
  }
}

function readLoggerConfig(reader: ConfReader): ValidatedNea<LoggerConfig> {
  return pipe(
    sequenceT(Either.getValidation(NonEmptyArray.getSemigroup<string>()))(
      reader(LogLevelOrOff.codec)('logger', 'consoleLevel'),
      reader(LogLevelOrOff.codec)('logger', 'discordDM', 'level'),
      reader(t.boolean)('logger', 'discordDM', 'compact')
    ),
    Either.map(_ => LoggerConfig(..._))
  )
}

/**
 * DbConfig
 */

interface DbConfig {
  host: string
  dbName: string
  user: string
  password: string
}

export function DbConfig(host: string, dbName: string, user: string, password: string): DbConfig {
  return { host, dbName, user, password }
}

export const readDbConfig = (reader: ConfReader): ValidatedNea<DbConfig> =>
  pipe(
    sequenceT(Either.getValidation(NonEmptyArray.getSemigroup<string>()))(
      reader(t.string)('db', 'host'),
      reader(t.string)('db', 'dbName'),
      reader(t.string)('db', 'user'),
      reader(t.string)('db', 'password')
    ),
    Either.map(([host, dbName, user, password]) => DbConfig(host, dbName, user, password))
  )
