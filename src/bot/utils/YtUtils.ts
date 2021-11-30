import type { AudioResource } from '@discordjs/voice'
import { createAudioResource } from '@discordjs/voice'
import { demuxProbe } from '@discordjs/voice'
import type { Options } from 'execa'
import { pipe } from 'fp-ts/function'
import type { YtFlags, YtResponse } from 'youtube-dl-exec'
import * as youtubeDlExec from 'youtube-dl-exec'

import { Either, Future, IO } from '../../shared/utils/fp'

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

const audioResource = (url: string): Future<AudioResource> =>
  pipe(
    IO.tryCatch(() =>
      youtubeDlExec.exec(
        url,
        {
          output: '-',
          quiet: true,
          format: 'bestaudio[ext=webm+acodec=opus+asr=48000]/bestaudio',
          limitRate: '100K',
        },
        { stdio: ['ignore', 'pipe', 'ignore'] },
      ),
    ),
    Future.fromIOEither,
    Future.chain(process => {
      if (process.stdout === null) return Future.left(Error('No stdout'))

      const stream = process.stdout
      return Future.tryCatch(
        () =>
          new Promise<AudioResource>((resolve, reject) => {
            /* eslint-disable functional/no-expression-statement */
            process
              .once('spawn', () =>
                demuxProbe(stream)
                  .then(probe =>
                    resolve(createAudioResource(probe.stream, { inputType: probe.type })),
                  )
                  .catch(onError),
              )
              .catch(onError)

            // eslint-disable-next-line functional/no-return-void
            function onError(error: Error): void {
              if (!process.killed) process.kill()
              stream.resume()
              reject(error)
            }
            /* eslint-enable functional/no-expression-statement */
          }),
      )
    }),
  )

export const YtUtils = { metadata, audioResource }
