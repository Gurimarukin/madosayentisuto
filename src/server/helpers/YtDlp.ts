import type { AudioResource } from '@discordjs/voice'
import { createAudioResource, demuxProbe } from '@discordjs/voice'
import { pipe } from 'fp-ts/function'
import { create as createYtDlp } from 'youtube-dl-exec'

import { Either, Future, IO } from '../../shared/utils/fp'
import { decodeError } from '../../shared/utils/ioTsUtils'

import { VideosMetadata } from '../models/audio/music/VideosMetadata'

export type YtDlp = ReturnType<typeof YtDlp>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const YtDlp = (binaryPath?: string) => {
  const ytDlpExec = createYtDlp(binaryPath)

  return {
    metadata: (url: string): Future<VideosMetadata> =>
      pipe(
        Future.tryCatch<unknown>(() =>
          ytDlpExec(
            url,
            {
              dumpSingleJson: true,
              defaultSearch: 'ytsearch',
              abortOnError: true,
            },
            { stdio: ['ignore', 'pipe', 'ignore'] },
          ),
        ),
        Future.chainEitherK(u =>
          pipe(VideosMetadata.decoder.decode(u), Either.mapLeft(decodeError('VideosMetadata')(u))),
        ),
      ),

    audioResource: (url: string): Future<AudioResource> =>
      pipe(
        IO.tryCatch(() =>
          ytDlpExec.exec(
            url,
            {
              output: '-',
              quiet: true,
              format: 'bestaudio[acodec=opus]/bestaudio[ext=webm]/bestaudio', // ext=webm+acodec=opus+asr=48000
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
