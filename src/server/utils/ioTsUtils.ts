import { predicate, string } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'
import type { Codec } from 'io-ts/Codec'
import * as C from 'io-ts/Codec'
import type { Decoder } from 'io-ts/Decoder'
import * as D from 'io-ts/Decoder'
import type { Encoder } from 'io-ts/Encoder'

import { DayJs } from '../../shared/models/DayJs'
import { Either, List, Maybe, NonEmptyArray } from '../../shared/utils/fp'

/**
 * DayJsFromDate
 */

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

/**
 * BooleanFromString
 */

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

/**
 * NumberFromString
 */

const numberFromStringDecoder: Decoder<unknown, number> = pipe(
  D.string,
  D.parse(s => {
    const n = Number(s)
    return isNaN(n) ? D.failure(s, 'NumberFromString') : D.success(n)
  }),
)

const numberFromStringEncoder: Encoder<string, number> = { encode: String }

const numberFromStringCodec: Codec<unknown, string, number> = C.make(
  numberFromStringDecoder,
  numberFromStringEncoder,
)

export const NumberFromString = {
  decoder: numberFromStringDecoder,
  encoder: numberFromStringEncoder,
  codec: numberFromStringCodec,
}

/**
 * ArrayFromString
 */

const prepareArray: (i: string) => List<string> = flow(
  string.split(','),
  NonEmptyArray.map(string.trim),
  List.filter(predicate.not(string.isEmpty)),
)

const arrayFromStringDecoder = <A>(decoder: Decoder<unknown, A>): Decoder<unknown, List<A>> =>
  pipe(D.string, D.map(prepareArray), D.compose(List.decoder(decoder)))

export const ArrayFromString = { decoder: arrayFromStringDecoder }

/**
 * NonEmptyArrayFromString
 */

const nonEmptyArrayFromStringDecoder = <A>(
  decoder: Decoder<unknown, A>,
): Decoder<unknown, NonEmptyArray<A>> =>
  pipe(D.string, D.map(prepareArray), D.compose(NonEmptyArray.decoder(decoder)))

export const NonEmptyArrayFromString = { decoder: nonEmptyArrayFromStringDecoder }

/**
 * CustomId
 */

const customIdDecoder = (prefix: string): Decoder<string, string> =>
  pipe(
    D.id<string>(),
    D.parse(raw => {
      const [rawPrefix, rawN, ...rest] = pipe(raw, string.split('-'))
      return pipe(
        Maybe.Do,
        Maybe.filter(() => rawPrefix === prefix && List.isEmpty(rest)),
        Maybe.chain(() => nonEmptyString(rawN)),
        Either.fromOption(() => D.error(raw, `CustomId@${prefix}`)),
      )
    }),
  )

const customIdEncoder = (prefix: string): Encoder<string, string> => ({
  encode: n => `${prefix}-${n}`,
})

const customIdCodec = (prefix: string): Codec<string, string, string> =>
  C.make(customIdDecoder(prefix), customIdEncoder(prefix))

export const CustomId = {
  decoder: customIdDecoder,
  encoder: customIdEncoder,
  codec: customIdCodec,
}

// raw should not be empty and not have additional triming spaces
const nonEmptyString = (raw: string | undefined): Maybe<string> => {
  if (raw === undefined || raw === '') return Maybe.none

  const trimed = raw.trim()
  return trimed === raw ? Maybe.some(raw) : Maybe.none
}

/**
 * TupleFromArrayStrict
 */

const listLengthDecoder = <A = never>(n: number): D.Decoder<List<A>, List<A>> => ({
  decode: as =>
    as.length === n
      ? D.success(as)
      : D.failure(
          as,
          `${((): string => {
            if (n === 0) return 'empty'
            if (n === 1) return '1-element'
            return `${n}-elements`
          })()} array`,
        ),
})

// additional elements are invalid

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tupleFromArrayStrictDecoder = <A extends ReadonlyArray<Decoder<any, any>>>(
  ...components: A
): Decoder<List<D.InputOf<A[number]>>, { [K in keyof A]: D.TypeOf<A[K]> }> =>
  pipe(
    listLengthDecoder<ReadonlyArray<D.InputOf<A[number]>>>(components.length),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    D.compose(D.fromTuple(...components) as any),
  )

export const TupleFromArrayStrict = { decoder: tupleFromArrayStrictDecoder }
