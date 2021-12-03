import type { AudioResource } from '@discordjs/voice'
import { createAudioResource } from '@discordjs/voice'
import { demuxProbe } from '@discordjs/voice'
import { json } from 'fp-ts'
import { pipe } from 'fp-ts/function'
import { create as createYoutubeDl } from 'youtube-dl-exec'

import { Either, Future, IO, List, Maybe } from '../../shared/utils/fp'

import { VideosMetadata } from '../models/music/VideosMetadata'
import { decodeError } from '../utils/decodeError'

export type YoutubeDl = ReturnType<typeof YoutubeDl>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const YoutubeDl = (binaryPath: string) => {
  const youtubeDlExec = createYoutubeDl(binaryPath)

  return {
    metadata: (url: string): Future<VideosMetadata> =>
      pipe(
        Future.tryCatch<unknown>(() =>
          youtubeDlExec(
            url,
            {
              dumpSingleJson: true,
              defaultSearch: 'ytsearch',
              ignoreErrors: true,
            },
            { stdio: ['ignore', 'pipe', 'ignore'] },
          ),
        ),
        Future.orElse(e =>
          pipe(
            e.message.split('\n', 2),
            List.lookup(1),
            Maybe.map(json.parse),
            Maybe.chain(Maybe.fromEither),
            Maybe.fold(() => Future.left(e), Future.right),
          ),
        ),
        Future.chain(u =>
          pipe(
            VideosMetadata.decoder.decode(u),
            Either.mapLeft(decodeError('VideosMetadata')(u)),
            Future.fromEither,
          ),
        ),
      ),

    audioResource: (url: string): Future<AudioResource> =>
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
      ),
  }
}
