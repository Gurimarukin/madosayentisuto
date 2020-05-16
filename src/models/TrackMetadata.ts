import * as t from 'io-ts'
import { Lens as MonocleLens } from 'monocle-ts'

export type TrackMetadata = t.TypeOf<typeof TrackMetadata.codec>

export function TrackMetadata(
  title: string,
  thumbnail: string,
  webpageUrl: string,
  _filename: string
): TrackMetadata {
  // eslint-disable-next-line @typescript-eslint/camelcase
  return { title, thumbnail, webpage_url: webpageUrl, _filename }
}

export namespace TrackMetadata {
  export const codec = t.strict({
    title: t.string,
    thumbnail: t.string,
    // eslint-disable-next-line @typescript-eslint/camelcase
    webpage_url: t.string,
    _filename: t.string
  })

  export namespace Lens {
    export const filename = MonocleLens.fromPath<TrackMetadata>()(['_filename'])
  }
}
