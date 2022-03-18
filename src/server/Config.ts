import type * as dotenv from 'dotenv'
import { pipe } from 'fp-ts/function'
import * as D from 'io-ts/Decoder'

import { ValidatedNea } from '../shared/models/ValidatedNea'
import { loadDotEnv } from '../shared/utils/config/loadDotEnv'
import { parseConfig } from '../shared/utils/config/parseConfig'
import { Either, IO } from '../shared/utils/fp'
import type { List, NonEmptyArray, Try } from '../shared/utils/fp'
import { Maybe } from '../shared/utils/fp'
import {
  ArrayFromString,
  BooleanFromString,
  NonEmptyArrayFromString,
  NumberFromString,
} from '../shared/utils/ioTsUtils'

import { TSnowflake } from './models/TSnowflake'
import { LogLevelOrOff } from './models/logger/LogLevel'

const { seqS } = ValidatedNea

export type Config = {
  readonly ytDlpPath: string
  readonly client: ClientConfig
  readonly admins: NonEmptyArray<TSnowflake>
  readonly logger: LoggerConfig
  readonly db: DbConfig
  readonly captain: CaptainConfig
  readonly http: HttpConfig
}

export type ClientConfig = {
  readonly id: string
  readonly secret: string
}

type LoggerConfig = {
  readonly consoleLevel: LogLevelOrOff
  readonly discordDm: LoggerDiscordDmConfig
}

type LoggerDiscordDmConfig = {
  readonly level: LogLevelOrOff
  readonly compact: boolean
}

type DbConfig = {
  readonly host: string
  readonly dbName: string
  readonly user: string
  readonly password: string
}

export type CaptainConfig = {
  readonly mentions: List<string>
  readonly thanks: List<string>
}

export type HttpConfig = {
  readonly port: number
  readonly allowedOrigins: Maybe<NonEmptyArray<string>>
  readonly disableAuth: boolean
}

const parse = (dict: dotenv.DotenvParseOutput): Try<Config> =>
  parseConfig(dict)(r =>
    seqS<Config>({
      ytDlpPath: r(D.string)('YTDLP_PATH'),
      client: seqS<ClientConfig>({
        id: r(D.string)('CLIENT_ID'),
        secret: r(D.string)('CLIENT_SECRET'),
      }),
      admins: r(NonEmptyArrayFromString.decoder(TSnowflake.codec))('ADMINS'),
      logger: seqS<LoggerConfig>({
        consoleLevel: r(LogLevelOrOff.codec)('LOGGER_CONSOLE_LEVEL'),
        discordDm: seqS<LoggerDiscordDmConfig>({
          level: r(LogLevelOrOff.codec)('LOGGER_DISCORD_DM_LEVEL'),
          compact: r(BooleanFromString.decoder)('LOGGER_DISCORD_DM_COMPACT'),
        }),
      }),
      db: seqS<DbConfig>({
        host: r(D.string)('DB_HOST'),
        dbName: r(D.string)('DB_NAME'),
        user: r(D.string)('DB_USER'),
        password: r(D.string)('DB_PASSWORD'),
      }),
      captain: seqS<CaptainConfig>({
        mentions: r(ArrayFromString.decoder(D.string))('CAPTAIN_MENTIONS'),
        thanks: r(ArrayFromString.decoder(D.string))('CAPTAIN_THANKS'),
      }),
      http: seqS<HttpConfig>({
        port: r(NumberFromString.decoder)('HTTP_PORT'),
        allowedOrigins: r(Maybe.decoder(NonEmptyArrayFromString.decoder(D.string)))(
          'HTTP_ALLOWED_ORIGINS',
        ),
        disableAuth: pipe(
          r(Maybe.decoder(BooleanFromString.decoder))('HTTP_DISABLE_AUTH'),
          Either.map(Maybe.getOrElseW(() => false)),
        ),
      }),
    }),
  )

const load = pipe(loadDotEnv, IO.map(parse), IO.chain(IO.fromEither))

export const Config = { load }
