import * as C from 'io-ts/Codec'
import * as D from 'io-ts/Decoder'
import * as E from 'io-ts/Encoder'
import type { Literal } from 'io-ts/Schemable'

import type { List } from '../../shared/utils/fp'

type Res<A> = {
  readonly values: List<A>
  readonly decoder: D.Decoder<unknown, A>
  readonly encoder: E.Encoder<A, A>
  readonly codec: C.Codec<unknown, A, A>
  readonly T: A
}

export const createEnum = <A extends Literal>(a: A, ...as: List<A>): Res<A> => {
  const values = [a, ...as]
  const decoder = D.union(C.literal(a), ...as.map(v => C.literal(v)))
  const encoder = E.id<A>()
  const codec = C.make(decoder, encoder)

  const res: Omit<Res<A>, 'T'> = { values, decoder, encoder, codec }
  return res as Res<A>
}