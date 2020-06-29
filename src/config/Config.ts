import * as t from 'io-ts'
import { sequenceT } from 'fp-ts/lib/Apply'
import { nonEmptyArray } from 'io-ts-types/lib/nonEmptyArray'

import { ConfReader } from './ConfReader'
import { ActivityTypeBot } from '../models/ActivityTypeBot'
import { LogLevelOrOff } from '../models/LogLevel'
import { TSnowflake } from '../models/TSnowflake'
import { ValidatedNea } from '../models/ValidatedNea'
import { IO, pipe, Either, NonEmptyArray, flow, Maybe } from '../utils/fp'
import { StringUtils } from '../utils/StringUtils'

export interface Config {
  readonly clientSecret: string
  readonly admins: NonEmptyArray<TSnowflake>
  readonly cmdPrefix: string
  readonly activity: Maybe<ActivityConfig>
  readonly logger: LoggerConfig
  readonly db: DbConfig
}
export function Config(
  clientSecret: string,
  admins: NonEmptyArray<TSnowflake>,
  cmdPrefix: string,
  activity: Maybe<ActivityConfig>,
  logger: LoggerConfig,
  db: DbConfig
): Config {
  return { clientSecret, admins, cmdPrefix, activity, logger, db }
}

export namespace Config {
  export function load(): IO<Config> {
    return pipe(
      ConfReader.fromFiles('./conf/local.conf.json', './conf/application.conf.json'),
      IO.chain(reader =>
        pipe(
          readConfig(reader),
          Either.mapLeft(
            flow(StringUtils.mkString('Errors while reading config:\n', '\n', ''), Error)
          ),
          IO.fromEither
        )
      )
    )
  }
}

function readConfig(reader: ConfReader): ValidatedNea<string, Config> {
  return pipe(
    sequenceT(Either.getValidation(NonEmptyArray.getSemigroup<string>()))(
      reader(t.string)('clientSecret'),
      reader(nonEmptyArray(TSnowflake.codec))('admins'),
      reader(t.string)('cmdPrefix'),
      readActivityConfig(reader),
      readLoggerConfig(reader),
      readDbConfig(reader)
    ),
    Either.map(_ => Config(..._))
  )
}

/**
 * ActivityConfig
 */
export function ActivityConfig(type: ActivityTypeBot, name: string): ActivityConfig {
  return { type, name }
}

export namespace ActivityConfig {
  export const codec = t.strict({
    type: ActivityTypeBot.codec,
    name: t.string
  })
}

export type ActivityConfig = t.TypeOf<typeof ActivityConfig.codec>

const nullableActivitConfig = t.union([ActivityConfig.codec, t.null])
function readActivityConfig(reader: ConfReader): ValidatedNea<string, Maybe<ActivityConfig>> {
  return pipe(reader(nullableActivitConfig)('activity'), Either.map(Maybe.fromNullable))
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

function readLoggerConfig(reader: ConfReader): ValidatedNea<string, LoggerConfig> {
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

function DbConfig(host: string, dbName: string, user: string, password: string): DbConfig {
  return { host, dbName, user, password }
}

function readDbConfig(reader: ConfReader): ValidatedNea<string, DbConfig> {
  return pipe(
    sequenceT(Either.getValidation(NonEmptyArray.getSemigroup<string>()))(
      reader(t.string)('db', 'host'),
      reader(t.string)('db', 'dbName'),
      reader(t.string)('db', 'user'),
      reader(t.string)('db', 'password')
    ),
    Either.map(_ => DbConfig(..._))
  )
}
