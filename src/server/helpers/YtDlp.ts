import type { AudioResource } from '@discordjs/voice'
import { StreamType, createAudioResource, demuxProbe } from '@discordjs/voice'
import type { io } from 'fp-ts'
import { string } from 'fp-ts'
import { pipe } from 'fp-ts/function'
import type { DecodeError } from 'io-ts/Decoder'
import type { Readable } from 'stream'
import { create as createYtDlp } from 'youtube-dl-exec'

import { createUnion } from '../../shared/utils/createUnion'
import type { NotUsed } from '../../shared/utils/fp'
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
  // 249 webm  audio only      2 │   475.72KiB   53k dash  │ audio only        opus        53k 48k low, webm_dash
  // 250 webm  audio only      2 │   627.80KiB   70k dash  │ audio only        opus        70k 48k low, webm_dash
  // 251 webm  audio only      2 │     1.19MiB  135k dash  │ audio only        opus       135k 48k medium, webm_dash
  const youtubeResource = audioResource('worstaudio[ext=webm][acodec=opus]', input =>
    Promise.resolve(createAudioResource(input, { inputType: StreamType.WebmOpus })),
  )

  // ID      EXT RESOLUTION │ PROTO │ VCODEC     ACODEC  ABR
  // ───────────────────────────────────────────────────────
  // mp3-128 mp3 audio only │ https │ audio only mp3    128k
  // const bandcampResource = audioResource('mp3-128', input =>
  //   demuxProbe(input).then(probe => createAudioResource(probe.stream, { inputType: probe.type })),
  // )

  const propeResource = audioResource('worstaudio', input =>
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
              ignoreErrors: true,
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

    audioResource: (
      { extractor, url }: ExtractorWithUrl,
      onProcessExitCodeError: (code: number, format: string, stderr: string) => io.IO<NotUsed>,
    ): Future<AudioResource> => {
      if (extractor.startsWith('youtube')) return youtubeResource(url, onProcessExitCodeError)
      // if (extractor === 'Bandcamp') return bandcampResource(url)
      return propeResource(url, onProcessExitCodeError)
    },
  }

  function audioResource(
    format: string,
    getAudioResource: (input: Readable) => Promise<AudioResource>,
  ): (
    url: string,
    onProcessExitCodeError: (code: number, format_: string, stderr: string) => io.IO<NotUsed>,
  ) => Future<AudioResource> {
    return (url, onProcessExitCodeError) =>
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
                /* eslint-disable functional/no-expression-statements */
                process.once('spawn', () => getAudioResource(stdout).then(resolve).catch(onError))

                process.once('error', onError)

                const errLines: string[] = []

                stderr.on('data', (err: Buffer) => {
                  // eslint-disable-next-line functional/immutable-data
                  errLines.push(err.toString('utf-8'))
                })

                process.once('exit', code => {
                  if (code !== null && code !== 0) {
                    onProcessExitCodeError(
                      code,
                      format,
                      pipe(errLines, List.mkString('\n'), string.trim),
                    )()
                  }
                })

                // eslint-disable-next-line functional/no-return-void
                function onError(error: Error): void {
                  if (!process.killed) process.kill()
                  stdout.resume()
                  reject(error)
                }
                /* eslint-enable functional/no-expression-statements */
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
