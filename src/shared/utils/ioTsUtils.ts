import { flow, pipe } from 'fp-ts/function'
import * as C from 'io-ts/Codec'
import * as D from 'io-ts/Decoder'
import type { AnyNewtype, CarrierOf } from 'newtype-ts'
import { iso } from 'newtype-ts'

import { StringUtils } from './StringUtils'
import { List } from './fp'
import { Either, NonEmptyArray } from './fp'

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
        |Value: ${pipe(JSON.stringify(value), StringUtils.ellipse(limit))}`,
      ),
    )

export const fromNewtype = <N extends AnyNewtype = never>(
  codec: C.Codec<unknown, CarrierOf<N>, CarrierOf<N>>,
): C.Codec<unknown, CarrierOf<N>, N> => {
  const { wrap, unwrap } = iso<N>()
  return C.make(
    { decode: flow(codec.decode, Either.map(wrap)) },
    { encode: flow(unwrap, codec.encode) },
  )
}

export const booleanFromString: D.Decoder<unknown, boolean> = pipe(
  D.string,
  D.parse(s =>
    s === 'true'
      ? D.success(true)
      : s === 'false'
      ? D.success(false)
      : D.failure(s, 'BooleanFromString'),
  ),
)

export const numberFromString: D.Decoder<unknown, number> = pipe(
  D.string,
  D.parse(s => {
    const n = Number(s)
    return isNaN(n) ? D.failure(s, 'NumberFromString') : D.success(n)
  }),
)

const prepareArray = (i: string): List<string> => i.split(',').map(s => s.trim())

export const arrayFromString = <A>(decoder: D.Decoder<unknown, A>): D.Decoder<unknown, List<A>> =>
  pipe(D.string, D.map(prepareArray), D.compose(List.decoder(decoder)))

export const nonEmptyArrayFromString = <A>(
  decoder: D.Decoder<unknown, A>,
): D.Decoder<unknown, NonEmptyArray<A>> =>
  pipe(D.string, D.map(prepareArray), D.compose(NonEmptyArray.decoder(decoder)))
