import { pipe } from 'fp-ts/function'
import type { Decoder } from 'io-ts/Decoder'
import * as D from 'io-ts/Decoder'

import { List, NonEmptyArray } from '../../../../shared/utils/fp'
import { Maybe } from '../../../../shared/utils/fp'

type MetadataType = 'video' | 'playlist'

export type VideoMetadata = D.TypeOf<typeof videoMetadataDecoder>

const videoMetadataDecoder = D.struct({
  title: D.string,
  url: Maybe.decoder(D.string),
  webpage_url: D.string,
  thumbnail: Maybe.decoder(D.string),
  playlist: Maybe.decoder(D.string),
  playlist_index: Maybe.decoder(D.number),
})

export type VideosMetadata = {
  readonly _type: MetadataType
  readonly extractor: string
  readonly videos: NonEmptyArray<VideoMetadata>
}

const videoDecoder = pipe(
  D.struct({
    _type: D.literal('video'),
    extractor: D.string,
  }),
  D.intersect(videoMetadataDecoder),
  D.map(({ _type, extractor, ...video }) => ({
    _type,
    extractor,
    videos: NonEmptyArray.of(video),
  })),
)

const playlistDecoder = pipe(
  D.struct({
    _type: D.literal('playlist'),
    extractor: D.string,
    entries: NonEmptyArray.decoder(Maybe.decoder(videoMetadataDecoder)),
  }),
  D.parse(({ _type, extractor, entries }) => {
    const compacted = List.compact(entries)
    return pipe(
      compacted,
      NonEmptyArray.fromReadonlyArray,
      Maybe.fold(
        () => D.failure(compacted, 'NonEmptyArray'),
        videos => D.success({ _type, extractor, videos }),
      ),
    )
  }),
)

const decoder: Decoder<unknown, VideosMetadata> = D.sum('_type')({
  video: videoDecoder,
  playlist: playlistDecoder,
})

export const VideosMetadata = { decoder }
