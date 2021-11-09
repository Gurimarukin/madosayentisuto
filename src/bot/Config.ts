import { ConfReader } from 'bot/helpers/ConfReader'
import { LogLevelOrOff } from 'bot/models/logger/LogLevel'
import { TSnowflake } from 'bot/models/TSnowflake'
import type { ValidatedNea } from 'bot/models/ValidatedNea'
import { StringUtils } from 'bot/utils/StringUtils'
import { apply } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'
import * as D from 'io-ts/Decoder'
import type { List } from 'shared/utils/fp'
import { Either, IO, NonEmptyArray } from 'shared/utils/fp'

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
  seqS({
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
  seqS({
    mentions: r(D.array(D.string))('captain', 'mentions'),
    thanks: r(D.array(D.string))('captain', 'thanks'),
  })
