import type { Options } from 'execa'
import { pipe } from 'fp-ts/function'
import type { YtFlags, YtResponse } from 'youtube-dl-exec'
import * as youtubeDlExec from 'youtube-dl-exec'

import { Either, Future } from '../../shared/utils/fp'

import { VideosMetadata } from '../models/music/VideosMetadata'
import { decodeError } from './decodeError'

/*
--flat-playlist                      Do not extract the videos of a
                                     playlist, only list them.

--skip-download                      Do not download the video
-g, --get-url                        Simulate, quiet but print URL
-e, --get-title                      Simulate, quiet but print title
--get-thumbnail                      Simulate, quiet but print thumbnail URL
--get-description                    Simulate, quiet but print video
                                     description
--get-duration                       Simulate, quiet but print video length
-j, --dump-json                      Simulate, quiet but print JSON
                                     information. See the "OUTPUT TEMPLATE"
                                     for a description of available keys.
-J, --dump-single-json               Simulate, quiet but print JSON
                                     information for each command-line
                                     argument. If the URL refers to a
                                     playlist, dump the whole playlist
                                     information in a single line.
--print-json                         Be quiet and print the video
                                     information as JSON (video is still
                                     being downloaded).

Stream to stdout: -o -
 */

const ytDl = (url: string, flags?: YtFlags, options?: Options<string>): Future<YtResponse> =>
  Future.tryCatch(() => youtubeDlExec.default(url, flags, options))

// const ytDlExec = (url: string, flags?: YtFlags, options?: Options<string>): ExecaChildProcess

const metadata = (url: string): Future<VideosMetadata> =>
  pipe(
    ytDl(url, { dumpSingleJson: true, defaultSearch: 'ytsearch' }),
    // Future.map(inspect('MyYtResponse')),
    Future.chain(u =>
      pipe(
        VideosMetadata.decoder.decode(u),
        Either.mapLeft(decodeError('VideosMetadata')(u)),
        Future.fromEither,
      ),
    ),
  )

// const stream = (url: string) => {
//   const res = youtubeDlExec.exec(url, { output: '-' })
// }

export const YtUtils = { metadata }
