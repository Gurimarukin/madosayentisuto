import type { Codec } from 'io-ts/Codec'
import * as C from 'io-ts/Codec'
import type { Decoder } from 'io-ts/Decoder'
import * as D from 'io-ts/Decoder'
import type { Encoder } from 'io-ts/Encoder'
import * as E from 'io-ts/Encoder'
import type { Literal } from 'io-ts/Schemable'

import type { List } from './fp'

type Res<A> = {
  values: List<A>
  decoder: Decoder<unknown, A>
  encoder: Encoder<A, A>
  codec: Codec<unknown, A, A>
  T: A
}

export const createEnum = <A extends Literal>(a: A, ...as: List<A>): Res<A> => {
  const values = [a, ...as]
  const decoder = D.union(C.literal(a), ...as.map(v => C.literal(v)))
  const encoder = E.id<A>()
  const codec = C.make(decoder, encoder)

  const res: Omit<Res<A>, 'T'> = { values, decoder, encoder, codec }
  return res as Res<A>
}
