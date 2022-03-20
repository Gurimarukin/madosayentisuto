import { json, predicate, string } from 'fp-ts'
import { pipe } from 'fp-ts/function'
import * as C from 'io-ts/Codec'
import * as D from 'io-ts/Decoder'
import type * as E from 'io-ts/Encoder'
import type { AnyNewtype, CarrierOf } from 'newtype-ts'

import { StringUtils } from './StringUtils'
import { Either, List } from './fp'
import { NonEmptyArray } from './fp'

const limit = 10000

export const decodeError =
  (name: string) =>
  (value: unknown) =>
  (error: D.DecodeError): Error =>
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
  codec: C.Codec<unknown, CarrierOf<N>, CarrierOf<N>>,
): C.Codec<unknown, CarrierOf<N>, N> => codec

// BooleanFromString

const booleanFromStringDecoder: D.Decoder<unknown, boolean> = pipe(
  D.string,
  D.parse(s =>
    s === 'true'
      ? D.success(true)
      : s === 'false'
      ? D.success(false)
      : D.failure(s, 'BooleanFromString'),
  ),
)

export const BooleanFromString = { decoder: booleanFromStringDecoder }

// NumberFromString

const numberFromStringDecoder: D.Decoder<unknown, number> = pipe(
  D.string,
  D.parse(s => {
    const n = Number(s)
    return isNaN(n) ? D.failure(s, 'NumberFromString') : D.success(n)
  }),
)

export const NumberFromString = { decoder: numberFromStringDecoder }

const prepareArray = (i: string): List<string> =>
  pipe(
    i,
    string.split(','),
    NonEmptyArray.map(string.trim),
    List.filter(predicate.not(string.isEmpty)),
  )

// ArrayFromString

const arrayFromStringDecoder = <A>(decoder: D.Decoder<unknown, A>): D.Decoder<unknown, List<A>> =>
  pipe(D.string, D.map(prepareArray), D.compose(List.decoder(decoder)))

export const ArrayFromString = { decoder: arrayFromStringDecoder }

// NonEmptyArrayFromString

const nonEmptyArrayFromStringDecoder = <A>(
  decoder: D.Decoder<unknown, A>,
): D.Decoder<unknown, NonEmptyArray<A>> =>
  pipe(D.string, D.map(prepareArray), D.compose(NonEmptyArray.decoder(decoder)))

export const NonEmptyArrayFromString = { decoder: nonEmptyArrayFromStringDecoder }

// DateFromISOString

const dateFromISOStringDecoder: D.Decoder<unknown, Date> = pipe(
  D.string,
  D.parse(str => {
    const d = new Date(str)
    return isNaN(d.getTime()) ? D.failure(str, 'DateFromISOString') : D.success(d)
  }),
)

const dateFromISOStringEncoder: E.Encoder<string, Date> = {
  encode: d => d.toISOString(),
}

const dateFromISOStringCodec: C.Codec<unknown, string, Date> = C.make(
  dateFromISOStringDecoder,
  dateFromISOStringEncoder,
)

export const DateFromISOString = {
  decoder: dateFromISOStringDecoder,
  encoder: dateFromISOStringEncoder,
  codec: dateFromISOStringCodec,
}
