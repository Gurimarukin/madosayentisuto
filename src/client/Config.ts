import { flow, pipe } from 'fp-ts/function'
import * as D from 'io-ts/Decoder'

import { ValidatedNea } from '../shared/models/ValidatedNea'
import { StringUtils } from '../shared/utils/StringUtils'
import { Either, NonEmptyArray, Try } from '../shared/utils/fp'

export type Config = {
  readonly apiHost: string
}

const r =
  <A>(decoder: D.Decoder<unknown, A>) =>
  (u: unknown): ValidatedNea<string, A> =>
    pipe(decoder.decode(u), Either.mapLeft(flow(D.draw, NonEmptyArray.of)))

const validate = ValidatedNea.sequenceS({
  apiHost: r(D.string)(process.env.API_HOST),
})

export const Config = pipe(
  validate,
  Either.mapLeft(flow(StringUtils.mkString('Errors while reading config:\n', '\n', ''), Error)),
  Try.getUnsafe,
)
