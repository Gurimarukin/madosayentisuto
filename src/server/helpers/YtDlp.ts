import type { AudioResource } from '@discordjs/voice'
import { StreamType, createAudioResource, demuxProbe } from '@discordjs/voice'
import { string } from 'fp-ts'
import { pipe } from 'fp-ts/function'
import type { DecodeError } from 'io-ts/Decoder'
import type { Readable } from 'stream'
import { Duplex } from 'stream'
import { create as createYtDlp } from 'youtube-dl-exec'

import { createUnion } from '../../shared/utils/createUnion'
import { Either, Future, IO, List, NonEmptyArray } from '../../shared/utils/fp'
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

type ExtractorWithUrl = {
  readonly extractor: string
  readonly url: string
}

type YtDlp = ReturnType<typeof YtDlp>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const YtDlp = (binaryPath: string) => {
  const ytDlpExec = createYtDlp(binaryPath)

  // ID  EXT   RESOLUTION FPS CH │    FILESIZE   TBR PROTO │ VCODEC        VBR ACODEC      ABR ASR MORE INFO
  // ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
  // 251 webm  audio only      2 │     1.19MiB  135k dash  │ audio only        opus       135k 48k medium, webm_dash
  const youtubeResource = audioResource('251', input =>
    Promise.resolve(createAudioResource(input, { inputType: StreamType.WebmOpus })),
  )

  // ID      EXT RESOLUTION │ PROTO │ VCODEC     ACODEC  ABR
  // ───────────────────────────────────────────────────────
  // mp3-128 mp3 audio only │ https │ audio only mp3    128k
  // const bandcampResource = audioResource('mp3-128', input =>
  //   demuxProbe(input).then(probe => createAudioResource(probe.stream, { inputType: probe.type })),
  // )

  const propeResource = audioResource('bestaudio', input =>
    demuxProbe(input).then(probe => createAudioResource(probe.stream, { inputType: probe.type })),
  )

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
            ? Future.successful(u.UnsupportedURLError(error))
            : Future.failed(error),
        ),
      ),

    audioResource: ({ extractor, url }: ExtractorWithUrl): Future<AudioResource> => {
      if (extractor === 'youtube:search' || extractor === 'youtube') return youtubeResource(url)
      // if (extractor === 'Bandcamp') return bandcampResource(url)
      return propeResource(url)
    },
  }

  function audioResource(
    format: string,
    getAudioResource: (input: Readable) => Promise<AudioResource>,
  ): (url: string) => Future<AudioResource> {
    return url =>
      pipe(
        IO.tryCatch(() =>
          ytDlpExec.exec(
            url,
            {
              output: '-',
              quiet: true,
              format,
              limitRate: '100K',
            },
            { stdio: ['ignore', 'pipe', 'pipe'] },
          ),
        ),
        Future.fromIOEither,
        Future.chain(process => {
          if (process.stdout === null) return Future.failed(Error('No stdout'))
          if (process.stderr === null) return Future.failed(Error('No stderr'))

          const stdout = process.stdout
          const stderr = process.stderr
          return Future.tryCatch(
            () =>
              new Promise<AudioResource>((resolve, reject) => {
                /* eslint-disable functional/no-expression-statements, functional/no-this-expressions */
                const result = new Duplex({
                  write(chunk, encoding, next) {
                    this.push(chunk, encoding)
                    next()
                  },
                  // eslint-disable-next-line @typescript-eslint/no-empty-function
                  read() {},
                })
                result.pause()
                stdout.pipe(result)

                stdout.once('data', () => {
                  result.resume()
                  getAudioResource(result).then(resolve).catch(onError)
                })

                process.catch(onError)

                const errLines: string[] = []

                stderr.on('data', (err: Buffer) => {
                  // eslint-disable-next-line functional/immutable-data
                  errLines.push(err.toString('utf-8'))
                })

                process.once('exit', code => {
                  if (code !== 0) {
                    onError(
                      Error(
                        pipe(
                          errLines,
                          List.mkString(`yt-dlp exited with status ${code}\n`, '\n', ''),
                          string.trimRight,
                        ),
                      ),
                    )
                  }
                })

                process.catch(onError)

                // eslint-disable-next-line functional/no-return-void
                function onError(error: Error): void {
                  if (!process.killed) process.kill()
                  stdout.resume()
                  reject(error)
                }
                /* eslint-enable functional/no-expression-statements, functional/no-this-expressions */
              }),
          )
        }),
      )
  }
}

export { YtDlp, YtDlpResult }

const isUnsupportedURLError =
  (url: string) =>
  (error: Error): boolean => {
    const lastLine = pipe(error.message, string.split('\n'), NonEmptyArray.last)
    return lastLine.trim() === `ERROR: Unsupported URL: ${url.trim()}`
  }
