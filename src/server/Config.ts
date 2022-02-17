import type * as dotenv from 'dotenv'
import { pipe } from 'fp-ts/function'
import * as D from 'io-ts/Decoder'

import { ValidatedNea } from '../shared/models/ValidatedNea'
import type { DecodeKey } from '../shared/utils/ConfigUtils'
import { ConfigUtils } from '../shared/utils/ConfigUtils'
import { IO } from '../shared/utils/fp'
import type { List, NonEmptyArray, Try } from '../shared/utils/fp'
import { Maybe } from '../shared/utils/fp'
import {
  arrayFromString,
  booleanFromString,
  nonEmptyArrayFromString,
  numberFromString,
} from '../shared/utils/ioTsUtils'

import { TSnowflake } from './models/TSnowflake'
import { LogLevelOrOff } from './models/logger/LogLevel'

export type Config = {
  readonly ytDlpPath: string
  readonly client: ClientConfig
  readonly admins: NonEmptyArray<TSnowflake>
  readonly logger: {
    readonly consoleLevel: LogLevelOrOff
    readonly discordDm: {
      readonly level: LogLevelOrOff
      readonly compact: boolean
    }
  }
  readonly db: {
    readonly host: string
    readonly dbName: string
    readonly user: string
    readonly password: string
  }
  readonly captain: CaptainConfig
  readonly http: HttpConfig
}

export type ClientConfig = {
  readonly id: string
  readonly secret: string
}

export type CaptainConfig = {
  readonly mentions: List<string>
  readonly thanks: List<string>
}

export type HttpConfig = {
  readonly port: number
  readonly allowedOrigins: Maybe<NonEmptyArray<string>>
}

const parse = (dict: dotenv.DotenvParseOutput): Try<Config> =>
  ConfigUtils.parseConfig(dict)(r =>
    ValidatedNea.sequenceS({
      ytDlpPath: r(D.string)('YTDLP_PATH'),
      client: parseClientConfig(r),
      admins: r(nonEmptyArrayFromString(TSnowflake.codec))('ADMINS'),
      logger: ValidatedNea.sequenceS({
        consoleLevel: r(LogLevelOrOff.codec)('LOGGER_CONSOLE_LEVEL'),
        discordDm: ValidatedNea.sequenceS({
          level: r(LogLevelOrOff.codec)('LOGGER_DISCORD_DM_LEVEL'),
          compact: r(booleanFromString)('LOGGER_DISCORD_DM_COMPACT'),
        }),
      }),
      db: ValidatedNea.sequenceS({
        host: r(D.string)('DB_HOST'),
        dbName: r(D.string)('DB_NAME'),
        user: r(D.string)('DB_USER'),
        password: r(D.string)('DB_PASSWORD'),
      }),
      captain: parseCaptainConfig(r),
      http: parseHttpConfig(r),
    }),
  )

const parseClientConfig = (r: DecodeKey): ValidatedNea<string, ClientConfig> =>
  ValidatedNea.sequenceS({
    id: r(D.string)('CLIENT_ID'),
    secret: r(D.string)('CLIENT_SECRET'),
  })

const parseCaptainConfig = (r: DecodeKey): ValidatedNea<string, CaptainConfig> =>
  ValidatedNea.sequenceS({
    mentions: r(arrayFromString(D.string))('CAPTAIN_MENTIONS'),
    thanks: r(arrayFromString(D.string))('CAPTAIN_THANKS'),
  })

const parseHttpConfig = (r: DecodeKey): ValidatedNea<string, HttpConfig> =>
  ValidatedNea.sequenceS({
    port: r(numberFromString)('HTTP_PORT'),
    allowedOrigins: r(Maybe.decoder(nonEmptyArrayFromString(D.string)))('HTTP_ALLOWED_ORIGINS'),
  })

const load = pipe(ConfigUtils.loadDotEnv, IO.map(parse), IO.chain(IO.fromEither))

export const Config = { load }
