import { json } from 'fp-ts'
import { pipe } from 'fp-ts/function'
import got, { HTTPError } from 'got'
import * as D from 'io-ts/Decoder'

import type { Method } from '../../shared/models/Method'
import { StringUtils } from '../../shared/utils/StringUtils'
import { Either, Future, Maybe } from '../../shared/utils/fp'
import { futureMaybe } from '../../shared/utils/futureMaybe'
import { decodeError } from '../../shared/utils/ioTsUtils'

import type { LoggerGetter } from '../models/logger/LoggerObservable'
import { unknownToError } from '../utils/unknownToError'

type EmojidexService = ReturnType<typeof EmojidexService>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const EmojidexService = (Logger: LoggerGetter) => {
  const logger = Logger('EmojidexService')

  return {
    getEmoji: (emojiRaw: string): Future<Maybe<string>> => {
      const emoji = pipe(
        parseEmojiMarkup(emojiRaw),
        Maybe.getOrElse(() => emojiRaw),
      )

      const method = 'get'
      const url = `https://emojidex.com/api/v1/emoji/${emoji}`

      return pipe(
        Future.tryCatch(() => got.get(url)),
        Future.chainFirstIOEitherK(res => logger.debug(formatRequest(method, url, res.statusCode))),
        Future.map(Maybe.some),
        Future.orElse(e => {
          if (!(e instanceof HTTPError)) return Future.left(e)
          const code = e.response.statusCode
          if (400 <= code && code < 500) {
            return pipe(
              Future.right(Maybe.none),
              Future.chainFirstIOEitherK(() => logger.debug(formatRequest(method, url, code))),
            )
          }
          return Future.left(e)
        }),
        futureMaybe.chainEitherK(res => pipe(json.parse(res.body), Either.mapLeft(unknownToError))),
        futureMaybe.chainEitherK(u =>
          pipe(EmojidexEmojiDecoder.decode(u), Either.mapLeft(decodeError('EmojidexEmoji')(u))),
        ),
        futureMaybe.map(e => e.moji),
      )
    },
  }
}

// :billy:
const parseEmojiMarkup: (raw: string) => Maybe<string> = StringUtils.matcher1(/^:(\S+):$/)

const EmojidexEmojiDecoder = D.struct({
  moji: D.string,
})

const formatRequest = (method: Method, url: string, status: number): string =>
  `${method.toUpperCase()} ${url} ${status}`

export { EmojidexService }
