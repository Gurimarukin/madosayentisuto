import { flow } from 'fp-ts/function'
import * as C from 'io-ts/Codec'
import type { AnyNewtype, CarrierOf } from 'newtype-ts'
import { iso } from 'newtype-ts'

import { Either } from 'shared/utils/fp'

export const fromNewtype = <N extends AnyNewtype = never>(
  codec: C.Codec<unknown, CarrierOf<N>, CarrierOf<N>>,
): C.Codec<unknown, CarrierOf<N>, N> => {
  const { wrap, unwrap } = iso<N>()
  return C.make(
    { decode: flow(codec.decode, Either.map(wrap)) },
    { encode: flow(unwrap, codec.encode) },
  )
}
