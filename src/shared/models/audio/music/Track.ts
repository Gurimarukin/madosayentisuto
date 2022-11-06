import { eq, string } from 'fp-ts'
import * as C from 'io-ts/Codec'

import { Maybe } from '../../../utils/fp'

type Track = C.TypeOf<typeof codec>

const codec = C.struct({
  title: C.string,
  url: C.string,
  thumbnail: Maybe.codec(C.string),
})

const of = (title: string, url: string, thumbnail: Maybe<string>): Track => ({
  title,
  url,
  thumbnail,
})

const Eq: eq.Eq<Track> = eq.struct({
  title: string.Eq,
  url: string.Eq,
  thumbnail: Maybe.getEq(string.Eq),
})

const Track = { of, codec, Eq }

export { Track }
