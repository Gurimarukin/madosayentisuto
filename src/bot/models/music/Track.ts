import { Maybe } from '../../../shared/utils/fp'

export type Track = {
  readonly title: string
  readonly url: string
  readonly thumbnail: Maybe<string>
}

const of = (title: string, url: string, thumbnail?: string): Track => ({
  title,
  url,
  thumbnail: Maybe.fromNullable(thumbnail),
})

export const Track = { of }
