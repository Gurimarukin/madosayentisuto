import * as C from 'io-ts/Codec'
import { AnyNewtype, CarrierOf, iso } from 'newtype-ts'

import { Either, flow } from './fp'

export function fromNewtype<N extends AnyNewtype = never>(
  codec: C.Codec<unknown, CarrierOf<N>, CarrierOf<N>>
): C.Codec<unknown, CarrierOf<N>, N> {
  const i = iso<N>()
  return C.make(
    { decode: flow(codec.decode, Either.map(i.wrap)) },
    { encode: flow(i.unwrap, codec.encode) }
  )
}
