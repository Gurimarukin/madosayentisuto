import * as Nea from 'fp-ts/lib/NonEmptyArray'
import * as t from 'io-ts'
import { sequenceT } from 'fp-ts/lib/Apply'
import { NonEmptyArray } from 'fp-ts/lib/NonEmptyArray'
import { nonEmptyArray } from 'io-ts-types/lib/nonEmptyArray'

import { ConfReader, ValidatedNea } from './ConfReader'
import { LogLevelOrOff } from '../models/LogLevel'
import { TSnowflake } from '../models/TSnowflake'
import { IO, pipe, Either } from '../utils/fp'

export interface Config {
  clientSecret: string
  logger: LoggerConfig
  cmdPrefix: string
}
export function Config(clientSecret: string, logger: LoggerConfig, cmdPrefix: string): Config {
  return { clientSecret, logger, cmdPrefix }
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
    sequenceT(Either.getValidation(Nea.getSemigroup<string>()))(
      reader(t.string)('clientSecret'),
      readLoggerConfig(reader),
      reader(t.string)('cmdPrefix')
    ),
    Either.map(_ => Config(..._))
  )
}

export interface LoggerConfig {
  consoleLevel: LogLevelOrOff
  discordDM: {
    level: LogLevelOrOff
    compact: boolean
    users: NonEmptyArray<TSnowflake>
  }
}
export function LoggerConfig(
  consoleLevel: LogLevelOrOff,
  discordDMlevel: LogLevelOrOff,
  discordDMCompact: boolean,
  discordDMUsers: NonEmptyArray<TSnowflake>
): LoggerConfig {
  return {
    consoleLevel,
    discordDM: { level: discordDMlevel, compact: discordDMCompact, users: discordDMUsers }
  }
}

function readLoggerConfig(reader: ConfReader): ValidatedNea<LoggerConfig> {
  return pipe(
    sequenceT(Either.getValidation(Nea.getSemigroup<string>()))(
      reader(LogLevelOrOff.codec)('logger', 'consoleLevel'),
      reader(LogLevelOrOff.codec)('logger', 'discordDM', 'level'),
      reader(t.boolean)('logger', 'discordDM', 'compact'),
      reader(nonEmptyArray(TSnowflake.codec))('logger', 'discordDM', 'users')
    ),
    Either.map(_ => LoggerConfig(..._))
  )
}
