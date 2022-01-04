import { flow, pipe } from 'fp-ts/function'
import * as D from 'io-ts/Decoder'

import { StringUtils } from '../shared/utils/StringUtils'
import { List } from '../shared/utils/fp'
import { Either, IO, Maybe, NonEmptyArray } from '../shared/utils/fp'

import { ConfReader } from './helpers/ConfReader'
import { TSnowflake } from './models/TSnowflake'
import { ValidatedNea } from './models/ValidatedNea'
import { LogLevelOrOff } from './models/logger/LogLevel'

export type Config = {
  readonly youtubeDlPath: string
  readonly client: ClientConfig
  readonly admins: NonEmptyArray<TSnowflake>
  readonly logger: {
    readonly consoleLevel: LogLevelOrOff
    readonly discordDM: {
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

export const Config = {
  load: (): IO<Config> =>
    pipe(
      ConfReader.fromFiles('./conf/server/local.conf.json', './conf/server/application.conf.json'),
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

const readConfig = (r: ConfReader): ValidatedNea<string, Config> =>
  ValidatedNea.sequenceS({
    youtubeDlPath: r(D.string)('youtubeDlPath'),
    client: readClientConfig(r),
    admins: r(NonEmptyArray.decoder(TSnowflake.codec))('admins'),
    logger: ValidatedNea.sequenceS({
      consoleLevel: r(LogLevelOrOff.codec)('logger', 'consoleLevel'),
      discordDM: ValidatedNea.sequenceS({
        level: r(LogLevelOrOff.codec)('logger', 'discordDM', 'level'),
        compact: r(D.boolean)('logger', 'discordDM', 'compact'),
      }),
    }),
    db: ValidatedNea.sequenceS({
      host: r(D.string)('db', 'host'),
      dbName: r(D.string)('db', 'dbName'),
      user: r(D.string)('db', 'user'),
      password: r(D.string)('db', 'password'),
    }),
    captain: readCaptainConfig(r),
    http: readHttpConfig(r),
  })

const readClientConfig = (r: ConfReader): ValidatedNea<string, ClientConfig> =>
  ValidatedNea.sequenceS({
    id: r(D.string)('client', 'id'),
    secret: r(D.string)('client', 'secret'),
  })

const readCaptainConfig = (r: ConfReader): ValidatedNea<string, CaptainConfig> =>
  ValidatedNea.sequenceS({
    mentions: r(List.decoder(D.string))('captain', 'mentions'),
    thanks: r(List.decoder(D.string))('captain', 'thanks'),
  })

const readHttpConfig = (r: ConfReader): ValidatedNea<string, HttpConfig> =>
  ValidatedNea.sequenceS({
    port: r(D.number)('http', 'port'),
    allowedOrigins: r(Maybe.decoder(NonEmptyArray.decoder(D.string)))('http', 'allowedOrigins'),
  })
