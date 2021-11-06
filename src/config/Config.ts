import { apply } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'
import * as D from 'io-ts/Decoder'

import { LogLevelOrOff } from '../models/LogLevel'
import { TSnowflake } from '../models/TSnowflake'
import { ValidatedNea } from '../models/ValidatedNea'
import { Either, IO, NonEmptyArray } from '../utils/fp'
import { StringUtils } from '../utils/StringUtils'
import { ConfReader } from './ConfReader'

const seqS = apply.sequenceS(Either.getApplicativeValidation(NonEmptyArray.getSemigroup<string>()))

export type Config = {
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
  seqS({
    client: readClientConfig(r),
    admins: r(NonEmptyArray.decoder(TSnowflake.codec))('admins'),
    logger: seqS({
      consoleLevel: r(LogLevelOrOff.codec)('logger', 'consoleLevel'),
      discordDM: seqS({
        level: r(LogLevelOrOff.codec)('logger', 'discordDM', 'level'),
        compact: r(D.boolean)('logger', 'discordDM', 'compact'),
      }),
    }),
    db: seqS({
      host: r(D.string)('db', 'host'),
      dbName: r(D.string)('db', 'dbName'),
      user: r(D.string)('db', 'user'),
      password: r(D.string)('db', 'password'),
    }),
  })

/**
 * ClientConfig
 */
export type ClientConfig = {
  readonly id: string
  readonly secret: string
}

const readClientConfig = (r: ConfReader): ValidatedNea<string, ClientConfig> =>
  seqS({
    id: r(D.string)('client', 'id'),
    secret: r(D.string)('client', 'secret'),
  })
