import { flow, pipe } from 'fp-ts/function'
import * as D from 'io-ts/Decoder'

import type { List } from '../shared/utils/fp'
import { Either, IO, NonEmptyArray } from '../shared/utils/fp'

import { ConfReader } from './helpers/ConfReader'
import { TSnowflake } from './models/TSnowflake'
import { ValidatedNea } from './models/ValidatedNea'
import { LogLevelOrOff } from './models/logger/LogLevel'
import { StringUtils } from './utils/StringUtils'

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
  })

/**
 * ClientConfig
 */
export type ClientConfig = {
  readonly id: string
  readonly secret: string
}

const readClientConfig = (r: ConfReader): ValidatedNea<string, ClientConfig> =>
  ValidatedNea.sequenceS({
    id: r(D.string)('client', 'id'),
    secret: r(D.string)('client', 'secret'),
  })

/**
 * CaptainConfig
 */
export type CaptainConfig = {
  readonly mentions: List<string>
  readonly thanks: List<string>
}

const readCaptainConfig = (r: ConfReader): ValidatedNea<string, CaptainConfig> =>
  ValidatedNea.sequenceS({
    mentions: r(D.array(D.string))('captain', 'mentions'),
    thanks: r(D.array(D.string))('captain', 'thanks'),
  })
