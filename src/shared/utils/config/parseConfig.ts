import { flow, pipe } from 'fp-ts/function'
import * as D from 'io-ts/Decoder'
import type { Decoder } from 'io-ts/Decoder'

import type { ValidatedNea } from '../../models/ValidatedNea'
import { StringUtils } from '../StringUtils'
import type { Dict, Try } from '../fp'
import { Either, NonEmptyArray } from '../fp'

export type DecodeKey = <B>(
  decoder: Decoder<unknown, B>,
) => (key: string) => ValidatedNea<string, B>

export const parseConfig =
  (rawConfig: Dict<string, string | undefined>) =>
  <A>(f: (r: DecodeKey) => ValidatedNea<string, A>): Try<A> =>
    pipe(
      f(
        <B>(decoder: Decoder<unknown, B>) =>
          (key: string) =>
            pipe(
              decoder.decode(rawConfig[key]),
              Either.mapLeft(e => NonEmptyArray.of(`${key}: ${D.draw(e)}`)),
            ),
      ),
      Either.mapLeft(flow(StringUtils.mkString('Errors while reading config:\n', '\n', ''), Error)),
    )
