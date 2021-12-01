import { pipe } from 'fp-ts/function'
import * as D from 'io-ts/Decoder'

import { Either, NonEmptyArray } from '../../../shared/utils/fp'
import { Maybe } from '../../../shared/utils/fp'

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
  readonly extractor: string
  readonly videos: NonEmptyArray<VideoMetadata>
}

const maybePlaylistDecoder = D.struct({
  _type: Maybe.decoder(D.literal('playlist')),
  extractor: D.string,
})

const playlistEntriesDecoder = D.struct({
  entries: NonEmptyArray.decoder(videoMetadataDecoder),
})

const decoder: D.Decoder<unknown, VideosMetadata> = {
  decode: (u: unknown) =>
    pipe(
      maybePlaylistDecoder.decode(u),
      Either.chain(({ _type, extractor }) =>
        pipe(
          _type,
          Maybe.fold(
            // not a playlist
            () =>
              pipe(
                videoMetadataDecoder.decode(u),
                Either.map(
                  (video): VideosMetadata => ({ extractor, videos: NonEmptyArray.of(video) }),
                ),
              ),
            // a playlist
            () =>
              pipe(
                playlistEntriesDecoder.decode(u),
                Either.map(({ entries: videos }): VideosMetadata => ({ extractor, videos })),
              ),
          ),
        ),
      ),
    ),
}

export const VideosMetadata = { decoder }
