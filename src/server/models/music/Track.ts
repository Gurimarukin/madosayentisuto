import type { Maybe } from '../../../shared/utils/fp'

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

export const Track = { of }
