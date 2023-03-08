import type { AudioResource } from '@discordjs/voice'
import { createAudioResource, demuxProbe } from '@discordjs/voice'
import { string } from 'fp-ts'
import { pipe } from 'fp-ts/function'
import type { DecodeError } from 'io-ts/Decoder'
import { create as createYtDlp } from 'youtube-dl-exec'

import { createUnion } from '../../shared/utils/createUnion'
import { Either, Future, IO, NonEmptyArray } from '../../shared/utils/fp'
import { decodeError } from '../../shared/utils/ioTsUtils'

import { VideosMetadata } from '../models/audio/music/VideosMetadata'

const u = createUnion({
  Success: (value: VideosMetadata) => ({ value }),
  UnsupportedURLError: (error: Error) => ({ error }),
  DecodeError: (json: unknown, error: DecodeError) => ({ json, error }),
})

type YtDlpResult = typeof u.T

const YtDlpResult = {
  decodeError: (e: typeof u.DecodeError.T): Error => decodeError('VideosMetadata')(e.json)(e.error),
}

type YtDlp = ReturnType<typeof YtDlp>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const YtDlp = (binaryPath: string) => {
  const ytDlpExec = createYtDlp(binaryPath)

  return {
    metadata: (url: string): Future<YtDlpResult> =>
      pipe(
        Future.tryCatch<unknown>(() =>
          ytDlpExec(
            url,
            {
              dumpSingleJson: true,
              defaultSearch: 'ytsearch',
              abortOnError: true,
            },
            { stdio: ['ignore', 'pipe', 'pipe'] },
          ),
        ),
        Future.map(json =>
          pipe(
            VideosMetadata.decoder.decode(json),
            Either.fold((error): YtDlpResult => u.DecodeError(json, error), u.Success),
          ),
        ),
        Future.orElse(error =>
          isUnsupportedURLError(url)(error)
            ? Future.right(u.UnsupportedURLError(error))
            : Future.left(error),
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

export { YtDlp, YtDlpResult }

const isUnsupportedURLError =
  (url: string) =>
  (error: Error): boolean => {
    const lastLine = pipe(error.message, string.split('\n'), NonEmptyArray.last)
    return lastLine.trim() === `ERROR: Unsupported URL: ${url.trim()}`
  }
