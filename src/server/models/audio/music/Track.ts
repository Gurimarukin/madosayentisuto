import { eq, string } from 'fp-ts'

import { Maybe } from '../../../../shared/utils/fp'

export type Track = {
  readonly title: string
  readonly url: string
  readonly thumbnail: Maybe<string>
}

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

export const Track = { of, Eq }
