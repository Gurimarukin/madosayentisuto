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
  readonly clientSecret: string
  readonly admins: NonEmptyArray<TSnowflake>
  readonly logger: LoggerConfig
  readonly cmdPrefix: string
}
export function Config(
  clientSecret: string,
  admins: NonEmptyArray<TSnowflake>,
  logger: LoggerConfig,
  cmdPrefix: string
): Config {
  return { clientSecret, admins, logger, cmdPrefix }
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
      reader(nonEmptyArray(TSnowflake.codec))('admins'),
      readLoggerConfig(reader),
      reader(t.string)('cmdPrefix')
    ),
    Either.map(_ => Config(..._))
  )
}

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
    sequenceT(Either.getValidation(Nea.getSemigroup<string>()))(
      reader(LogLevelOrOff.codec)('logger', 'consoleLevel'),
      reader(LogLevelOrOff.codec)('logger', 'discordDM', 'level'),
      reader(t.boolean)('logger', 'discordDM', 'compact')
    ),
    Either.map(_ => LoggerConfig(..._))
  )
}
