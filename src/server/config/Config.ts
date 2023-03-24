import type * as dotenv from 'dotenv'
import { pipe } from 'fp-ts/function'
import * as D from 'io-ts/Decoder'

import { DiscordUserId } from '../../shared/models/DiscordUserId'
import { MsDuration } from '../../shared/models/MsDuration'
import { ValidatedNea } from '../../shared/models/ValidatedNea'
import { GuildId } from '../../shared/models/guild/GuildId'
import { LogLevelOrOff } from '../../shared/models/log/LogLevel'
import { loadDotEnv } from '../../shared/utils/config/loadDotEnv'
import { parseConfig } from '../../shared/utils/config/parseConfig'
import type { List, NonEmptyArray, Try } from '../../shared/utils/fp'
import { Either, IO, Maybe } from '../../shared/utils/fp'
import { URLFromString } from '../../shared/utils/ioTsUtils'

import { BotToken } from '../models/discord/BotToken'
import {
  ArrayFromString,
  BooleanFromString,
  NonEmptyArrayFromString,
  NumberFromString,
} from '../utils/ioTsUtils'

const seqS = ValidatedNea.getSeqS<string>()

export type Config = {
  readonly isDev: boolean
  readonly logger: LoggerConfig
  readonly client: ClientConfig
  readonly http: HttpConfig
  readonly db: DbConfig
  readonly jwtSecret: string
  readonly ytDlpPath: string
  readonly admins: NonEmptyArray<DiscordUserId>
  readonly uwuServers: List<GuildId>
  readonly kohLantaVictims: List<DiscordUserId>
  readonly captain: CaptainConfig
  readonly elevatorDelay: MsDuration
  readonly theQuest: TheQuestConfig
}

type LoggerConfig = {
  readonly consoleLevel: LogLevelOrOff
  readonly discordDM: LoggerDiscordDMConfig
}

export type ClientConfig = {
  readonly id: DiscordUserId
  readonly token: BotToken
}

export type HttpConfig = {
  readonly port: number
  readonly allowedOrigins: Maybe<NonEmptyArray<URL>>
}

type DbConfig = {
  readonly host: string
  readonly dbName: string
  readonly user: string
  readonly password: string
}

export type LoggerDiscordDMConfig = {
  readonly level: LogLevelOrOff
  readonly isCompact: boolean
}

export type CaptainConfig = {
  readonly mentions: List<string>
  readonly thanks: List<string>
}

export type TheQuestConfig = {
  readonly webappUrl: string
  readonly apiUrl: string
  readonly token: string
}

const parse = (dict: dotenv.DotenvParseOutput): Try<Config> =>
  parseConfig(dict)(r =>
    seqS<Config>({
      isDev: pipe(
        r(Maybe.decoder(BooleanFromString.decoder))('IS_DEV'),
        Either.map(Maybe.getOrElseW(() => false)),
      ),
      logger: seqS<LoggerConfig>({
        consoleLevel: r(LogLevelOrOff.codec)('LOGGER_CONSOLE_LEVEL'),
        discordDM: seqS<LoggerDiscordDMConfig>({
          level: r(LogLevelOrOff.codec)('LOGGER_DISCORD_DM_LEVEL'),
          isCompact: r(BooleanFromString.decoder)('LOGGER_DISCORD_DM_IS_COMPACT'),
        }),
      }),
      client: seqS<ClientConfig>({
        id: r(DiscordUserId.codec)('CLIENT_ID'),
        token: r(BotToken.codec)('CLIENT_SECRET'),
      }),
      http: seqS<HttpConfig>({
        port: r(NumberFromString.decoder)('HTTP_PORT'),
        allowedOrigins: r(Maybe.decoder(NonEmptyArrayFromString.decoder(URLFromString.decoder)))(
          'HTTP_ALLOWED_ORIGINS',
        ),
      }),
      db: seqS<DbConfig>({
        host: r(D.string)('DB_HOST'),
        dbName: r(D.string)('DB_NAME'),
        user: r(D.string)('DB_USER'),
        password: r(D.string)('DB_PASSWORD'),
      }),
      jwtSecret: r(D.string)('JWT_SECRET'),
      ytDlpPath: r(D.string)('YTDLP_PATH'),
      admins: r(NonEmptyArrayFromString.decoder(DiscordUserId.codec))('ADMINS'),
      uwuServers: r(ArrayFromString.decoder(GuildId.codec))('UWU_SERVERS'),
      kohLantaVictims: r(ArrayFromString.decoder(DiscordUserId.codec))('KOH_LANTA_VICTIMS'),
      captain: seqS<CaptainConfig>({
        mentions: r(ArrayFromString.decoder(D.string))('CAPTAIN_MENTIONS'),
        thanks: r(ArrayFromString.decoder(D.string))('CAPTAIN_THANKS'),
      }),
      elevatorDelay: r(MsDuration.decoder)('ELEVATOR_DELAY'),
      theQuest: seqS<TheQuestConfig>({
        webappUrl: r(D.string)('THE_QUEST_WEBAPP_URL'),
        apiUrl: r(D.string)('THE_QUEST_API_URL'),
        token: r(D.string)('THE_QUEST_TOKEN'),
      }),
    }),
  )

const load: IO<Config> = pipe(loadDotEnv, IO.map(parse), IO.chain(IO.fromEither))

export const Config = { load }
