import { json } from 'fp-ts'
import { pipe } from 'fp-ts/function'
import type { Codec } from 'io-ts/Codec'
import * as C from 'io-ts/Codec'
import type { DecodeError, Decoder } from 'io-ts/Decoder'
import * as D from 'io-ts/Decoder'
import type { Encoder } from 'io-ts/Encoder'
import type { AnyNewtype, CarrierOf } from 'newtype-ts'

import { DayJs } from '../models/DayJs'
import { StringUtils } from './StringUtils'
import { Either, Maybe } from './fp'

const limit = 10000

export const decodeError =
  (name: string) =>
  (value: unknown) =>
  (error: DecodeError): Error =>
    Error(
      StringUtils.stripMargins(
        `Couldn't decode ${name}:
        |Error:
        |${pipe(D.draw(error), StringUtils.ellipse(limit))}
        |
        |Value: ${pipe(
          json.stringify(value),
          Either.getOrElse(() => `${value}`),
          StringUtils.ellipse(limit),
        )}`,
      ),
    )

export const fromNewtype = <N extends AnyNewtype = never>(
  codec: Codec<unknown, CarrierOf<N>, CarrierOf<N>>,
): Codec<unknown, CarrierOf<N>, N> => codec

/**
 * DayJsFromISOString
 */

const dayJsFromISOStringDecoder: Decoder<unknown, DayJs> = pipe(
  D.string,
  D.parse(str => {
    const d = DayJs.of(str)
    return DayJs.isValid(d) ? D.success(d) : D.failure(str, 'DayJsFromISOString')
  }),
)

const dayJsFromISOStringEncoder: Encoder<string, DayJs> = { encode: DayJs.toISOString }

const dayJsFromISOStringCodec: Codec<unknown, string, DayJs> = C.make(
  dayJsFromISOStringDecoder,
  dayJsFromISOStringEncoder,
)

export const DayJsFromISOString = {
  decoder: dayJsFromISOStringDecoder,
  encoder: dayJsFromISOStringEncoder,
  codec: dayJsFromISOStringCodec,
}

/**
 * URLFromString
 */

const urlFromStringDecoder: Decoder<unknown, URL> = pipe(
  D.string,
  D.parse(s =>
    pipe(
      Maybe.tryCatch(() => new URL(s)),
      Maybe.fold(() => D.failure(s, 'URLFromString'), D.success),
    ),
  ),
)

export const URLFromString = { decoder: urlFromStringDecoder }
