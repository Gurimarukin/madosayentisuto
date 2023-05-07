import { eq, string } from 'fp-ts'
import * as C from 'io-ts/Codec'

import { Maybe } from '../../../utils/fp'

type Track = C.TypeOf<typeof codec>

const codec = C.struct({
  extractor: C.string,
  title: C.string,
  url: C.string,
  thumbnail: Maybe.codec(C.string),
})

const Eq: eq.Eq<Track> = eq.struct({
  title: string.Eq,
  url: string.Eq,
  thumbnail: Maybe.getEq(string.Eq),
})

const Track = { codec, Eq }

export { Track }
