import { sequenceT } from 'fp-ts/lib/Apply'
import * as D from 'io-ts/Decoder'

import { LogLevelOrOff } from '../models/LogLevel'
import { TSnowflake } from '../models/TSnowflake'
import { ValidatedNea } from '../models/ValidatedNea'
import { Either, IO, NonEmptyArray, flow, pipe } from '../utils/fp'
import { StringUtils } from '../utils/StringUtils'
import { ConfReader } from './ConfReader'

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
  db: DbConfig,
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
          Either.mapLeft(
            flow(StringUtils.mkString('Errors while reading config:\n', '\n', ''), Error),
          ),
          IO.fromEither,
        ),
      ),
    )
  }
}

function readConfig(reader: ConfReader): ValidatedNea<string, Config> {
  return pipe(
    sequenceT(Either.getValidation(NonEmptyArray.getSemigroup<string>()))(
      reader(D.string)('clientSecret'),
      reader(NonEmptyArray.decoder(TSnowflake.codec))('admins'),
      reader(D.string)('cmdPrefix'),
      readLoggerConfig(reader),
      readDbConfig(reader),
    ),
    Either.map(_ => Config(..._)),
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
  discordDMCompact: boolean,
): LoggerConfig {
  return {
    consoleLevel,
    discordDM: { level: discordDMlevel, compact: discordDMCompact },
  }
}

function readLoggerConfig(reader: ConfReader): ValidatedNea<string, LoggerConfig> {
  return pipe(
    sequenceT(Either.getValidation(NonEmptyArray.getSemigroup<string>()))(
      reader(LogLevelOrOff.codec)('logger', 'consoleLevel'),
      reader(LogLevelOrOff.codec)('logger', 'discordDM', 'level'),
      reader(D.boolean)('logger', 'discordDM', 'compact'),
    ),
    Either.map(_ => LoggerConfig(..._)),
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

function DbConfig(host: string, dbName: string, user: string, password: string): DbConfig {
  return { host, dbName, user, password }
}

function readDbConfig(reader: ConfReader): ValidatedNea<string, DbConfig> {
  return pipe(
    sequenceT(Either.getValidation(NonEmptyArray.getSemigroup<string>()))(
      reader(D.string)('db', 'host'),
      reader(D.string)('db', 'dbName'),
      reader(D.string)('db', 'user'),
      reader(D.string)('db', 'password'),
    ),
    Either.map(_ => DbConfig(..._)),
  )
}
