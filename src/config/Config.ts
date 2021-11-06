import { apply } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'
import * as D from 'io-ts/Decoder'

import { LogLevelOrOff } from '../models/LogLevel'
import { TSnowflake } from '../models/TSnowflake'
import { ValidatedNea } from '../models/ValidatedNea'
import { Either, IO, NonEmptyArray } from '../utils/fp'
import { StringUtils } from '../utils/StringUtils'
import { ConfReader } from './ConfReader'

export type Config = {
  readonly clientId: string
  readonly clientSecret: string
  readonly admins: NonEmptyArray<TSnowflake>
  readonly logger: LoggerConfig
  readonly db: DbConfig
}
export const Config = {
  load: (): IO<Config> =>
    pipe(
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
    ),
}

const readConfig = (reader: ConfReader): ValidatedNea<string, Config> =>
  apply.sequenceS(Either.getApplicativeValidation(NonEmptyArray.getSemigroup<string>()))({
    clientId: reader(D.string)('clientId'),
    clientSecret: reader(D.string)('clientSecret'),
    admins: reader(NonEmptyArray.decoder(TSnowflake.codec))('admins'),
    logger: readLoggerConfig(reader),
    db: readDbConfig(reader),
  })

/**
 * LoggerConfig
 */
export type LoggerConfig = {
  readonly consoleLevel: LogLevelOrOff
  readonly discordDM: {
    readonly level: LogLevelOrOff
    readonly compact: boolean
  }
}

export const LoggerConfig = {
  of: (
    consoleLevel: LogLevelOrOff,
    discordDMlevel: LogLevelOrOff,
    discordDMCompact: boolean,
  ): LoggerConfig => ({
    consoleLevel,
    discordDM: { level: discordDMlevel, compact: discordDMCompact },
  }),
}

const readLoggerConfig = (reader: ConfReader): ValidatedNea<string, LoggerConfig> =>
  pipe(
    apply.sequenceT(Either.getApplicativeValidation(NonEmptyArray.getSemigroup<string>()))(
      reader(LogLevelOrOff.codec)('logger', 'consoleLevel'),
      reader(LogLevelOrOff.codec)('logger', 'discordDM', 'level'),
      reader(D.boolean)('logger', 'discordDM', 'compact'),
    ),
    Either.map(args => LoggerConfig.of(...args)),
  )

/**
 * DbConfig
 */
type DbConfig = {
  readonly host: string
  readonly dbName: string
  readonly user: string
  readonly password: string
}

const readDbConfig = (reader: ConfReader): ValidatedNea<string, DbConfig> =>
  apply.sequenceS(Either.getApplicativeValidation(NonEmptyArray.getSemigroup<string>()))({
    host: reader(D.string)('db', 'host'),
    dbName: reader(D.string)('db', 'dbName'),
    user: reader(D.string)('db', 'user'),
    password: reader(D.string)('db', 'password'),
  })
