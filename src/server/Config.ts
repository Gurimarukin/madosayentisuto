import type * as dotenv from 'dotenv'
import { pipe } from 'fp-ts/function'
import * as D from 'io-ts/Decoder'

import { DiscordUserId } from '../shared/models/DiscordUserId'
import { LogLevelOrOff } from '../shared/models/LogLevel'
import { ValidatedNea } from '../shared/models/ValidatedNea'
import { loadDotEnv } from '../shared/utils/config/loadDotEnv'
import { parseConfig } from '../shared/utils/config/parseConfig'
import { Either, IO } from '../shared/utils/fp'
import type { List, NonEmptyArray, Try } from '../shared/utils/fp'
import { Maybe } from '../shared/utils/fp'
import { URLFromString } from '../shared/utils/ioTsUtils'

import {
  ArrayFromString,
  BooleanFromString,
  NonEmptyArrayFromString,
  NumberFromString,
} from './utils/ioTsUtils'

const { seqS } = ValidatedNea

export type Config = {
  readonly isDev: boolean
  readonly ytDlpPath: string
  readonly jwtSecret: string
  readonly client: ClientConfig
  readonly admins: NonEmptyArray<DiscordUserId>
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
  readonly discordDM: LoggerDiscordDMConfig
}

export type LoggerDiscordDMConfig = {
  readonly level: LogLevelOrOff
  readonly isCompact: boolean
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
  readonly allowedOrigins: Maybe<NonEmptyArray<URL>>
}

const parse = (dict: dotenv.DotenvParseOutput): Try<Config> =>
  parseConfig(dict)(r =>
    seqS<Config>({
      isDev: pipe(
        r(Maybe.decoder(BooleanFromString.decoder))('IS_DEV'),
        Either.map(Maybe.getOrElseW(() => false)),
      ),
      ytDlpPath: r(D.string)('YTDLP_PATH'),
      jwtSecret: r(D.string)('JWT_SECRET'),
      client: seqS<ClientConfig>({
        id: r(D.string)('CLIENT_ID'),
        secret: r(D.string)('CLIENT_SECRET'),
      }),
      admins: r(NonEmptyArrayFromString.decoder(DiscordUserId.codec))('ADMINS'),
      logger: seqS<LoggerConfig>({
        consoleLevel: r(LogLevelOrOff.codec)('LOGGER_CONSOLE_LEVEL'),
        discordDM: seqS<LoggerDiscordDMConfig>({
          level: r(LogLevelOrOff.codec)('LOGGER_DISCORD_DM_LEVEL'),
          isCompact: r(BooleanFromString.decoder)('LOGGER_DISCORD_DM_IS_COMPACT'),
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
        allowedOrigins: r(Maybe.decoder(NonEmptyArrayFromString.decoder(URLFromString.decoder)))(
          'HTTP_ALLOWED_ORIGINS',
        ),
      }),
    }),
  )

const load = pipe(loadDotEnv, IO.map(parse), IO.chain(IO.fromEither))

export const Config = { load }
