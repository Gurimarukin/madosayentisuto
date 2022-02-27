import type { Match } from 'fp-ts-routing'
import type { AnyNewtype, CarrierOf } from 'newtype-ts'

import type { Dict } from './fp'

function codec<K extends string>(
  k: K,
): <N extends AnyNewtype = never>(
  match: (k_: K) => Match<Dict<K, CarrierOf<N>>>,
) => Match<Dict<K, N>> {
  return match => match(k)
}

export const RouterUtils = { codec }
