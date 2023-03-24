import { pipe } from 'fp-ts/function'
import * as D from 'io-ts/Decoder'

import { StringUtils } from '../../shared/utils/StringUtils'
import type { Future } from '../../shared/utils/fp'
import { Maybe } from '../../shared/utils/fp'
import { futureMaybe } from '../../shared/utils/futureMaybe'

import type { HttpClient } from '../helpers/HttpClient'
import { statusesToOption } from '../helpers/HttpClient'

type EmojidexService = ReturnType<typeof EmojidexService>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const EmojidexService = (httpClient: HttpClient) => ({
  getEmoji: (emojiRaw: string): Future<Maybe<string>> => {
    const emoji = pipe(
      parseEmojiMarkup(emojiRaw),
      Maybe.getOrElse(() => emojiRaw),
    )

    return pipe(
      httpClient.http([`https://emojidex.com/api/v1/emoji/${emoji}`, 'get'], {}, [
        emojidexEmojiDecoder,
        'EmojidexEmoji',
      ]),
      statusesToOption(404),
      futureMaybe.map(e => e.moji),
    )
  },
})

// :billy:
const parseEmojiMarkup: (raw: string) => Maybe<string> = StringUtils.matcher1(/^:(\S+):$/)

const emojidexEmojiDecoder = D.struct({
  moji: D.string,
})

export { EmojidexService }
