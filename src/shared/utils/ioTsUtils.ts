import { json, predicate, string } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'
import * as C from 'io-ts/Codec'
import type { Codec } from 'io-ts/Codec'
import * as D from 'io-ts/Decoder'
import type { DecodeError, Decoder } from 'io-ts/Decoder'
import type { Encoder } from 'io-ts/Encoder'
import type { AnyNewtype, CarrierOf } from 'newtype-ts'

import { DayJs } from '../models/DayJs'
import { StringUtils } from './StringUtils'
import { Either, List, Maybe, Try } from './fp'
import { NonEmptyArray } from './fp'

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

// DayJsFromISOString

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

// DayJsFromDate

const dayJsFromDateDecoder: Decoder<unknown, DayJs> = {
  decode: i =>
    pipe(
      i,
      Maybe.fromPredicate((u): u is Date => u instanceof Date),
      Maybe.map(d => DayJs.of(d)),
      Maybe.filter(DayJs.isValid),
      Maybe.fold(() => D.failure(i, 'DayJsFromDate'), D.success),
    ),
}

const dayJsFromDateEncoder: Encoder<Date, DayJs> = { encode: DayJs.toDate }

const dayJsFromDateCodec: Codec<unknown, Date, DayJs> = C.make(
  dayJsFromDateDecoder,
  dayJsFromDateEncoder,
)

export const DayJsFromDate = {
  decoder: dayJsFromDateDecoder,
  encoder: dayJsFromDateEncoder,
  codec: dayJsFromDateCodec,
}

// BooleanFromString

const booleanFromStringDecoder: Decoder<unknown, boolean> = pipe(
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

const numberFromStringDecoder: Decoder<unknown, number> = pipe(
  D.string,
  D.parse(s => {
    const n = Number(s)
    return isNaN(n) ? D.failure(s, 'NumberFromString') : D.success(n)
  }),
)

export const NumberFromString = { decoder: numberFromStringDecoder }

const prepareArray: (i: string) => List<string> = flow(
  string.split(','),
  NonEmptyArray.map(string.trim),
  List.filter(predicate.not(string.isEmpty)),
)

// URLFromString

const urlFromStringDecoder: Decoder<unknown, URL> = pipe(
  D.string,
  D.parse(s =>
    pipe(
      Try.tryCatch(() => new URL(s)),
      Try.fold(() => D.failure(s, 'URLFromString'), D.success),
    ),
  ),
)

export const URLFromString = { decoder: urlFromStringDecoder }

// ArrayFromString

const arrayFromStringDecoder = <A>(decoder: Decoder<unknown, A>): Decoder<unknown, List<A>> =>
  pipe(D.string, D.map(prepareArray), D.compose(List.decoder(decoder)))

export const ArrayFromString = { decoder: arrayFromStringDecoder }

// NonEmptyArrayFromString

const nonEmptyArrayFromStringDecoder = <A>(
  decoder: Decoder<unknown, A>,
): Decoder<unknown, NonEmptyArray<A>> =>
  pipe(D.string, D.map(prepareArray), D.compose(NonEmptyArray.decoder(decoder)))

export const NonEmptyArrayFromString = { decoder: nonEmptyArrayFromStringDecoder }
