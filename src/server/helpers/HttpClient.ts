import { number, task } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'
import type { Decoder } from 'io-ts/Decoder'
import type { Encoder } from 'io-ts/Encoder'
import type { Options } from 'ky'
import ky, { HTTPError } from 'ky'

import type { HttpMethod } from '../../shared/models/HttpMethod'
import type { NonEmptyArray, Tuple } from '../../shared/utils/fp'
import { Either, Future, IO, List, Maybe, Try } from '../../shared/utils/fp'
import { decodeError } from '../../shared/utils/ioTsUtils'

import type { LoggerGetter } from '../models/logger/LoggerObservable'

export type HttpOptions<O, B> = Omit<Options, 'url' | 'method' | 'json'> & {
  json?: Tuple<Encoder<O, B>, B>
}

type HttpClient = ReturnType<typeof HttpClient>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const HttpClient = (Logger: LoggerGetter) => {
  const logger = Logger('HttpClient')

  function http<O, B>(
    methodWithUrl: Tuple<string, HttpMethod>,
    options?: HttpOptions<O, B>,
  ): Future<unknown>
  function http<A, O, B>(
    methodWithUrl: Tuple<string, HttpMethod>,
    options: HttpOptions<O, B>,
    decoderWithName: Tuple<Decoder<unknown, A>, string>,
  ): Future<A>
  function http<A, O, B>(
    [url, method]: Tuple<string, HttpMethod>,
    { headers, json, ...options }: HttpOptions<O, B> = {},
    decoderWithName?: Tuple<Decoder<unknown, A>, string>,
  ): Future<A> {
    const jsonEncoded = ((): O | undefined => {
      if (json === undefined) return undefined
      const [encoder, b] = json
      return encoder.encode(b)
    })()

    return pipe(
      Future.tryCatch(() =>
        ky[method](url, {
          ...options,
          method,
          headers:
            jsonEncoded === undefined
              ? headers
              : {
                  'Content-Type': 'application/json',
                  ...headers,
                },
          body: jsonEncoded === undefined ? undefined : JSON.stringify(jsonEncoded),
        }),
      ),
      task.chainFirstIOK(
        flow(
          Try.fold(
            e => (e instanceof HTTPError ? Maybe.some(e.response.status) : Maybe.none),
            res => Maybe.some(res.status),
          ),
          Maybe.fold(() => IO.notUsed, flow(formatRequest(method, url), logger.trace)),
        ),
      ),
      Future.chain(res => Future.tryCatch(() => res.json())),
      Future.chainEitherK(u => {
        if (decoderWithName === undefined) return Either.right(u as A)
        const [decoder, decoderName] = decoderWithName
        return pipe(decoder.decode(u), Either.mapLeft(decodeError(decoderName)(u)))
      }),
    )
  }

  return { http }
}

export const statusesToOption = (
  ...statuses: NonEmptyArray<number>
): (<A>(fa: Future<A>) => Future<Maybe<A>>) =>
  flow(
    Future.map(Maybe.some),
    Future.orElseEitherK(e =>
      e instanceof HTTPError && pipe(statuses, List.elem(number.Eq)(e.response.status))
        ? Try.success(Maybe.none)
        : Try.failure(e),
    ),
  )

export { HttpClient }

const formatRequest =
  (method: HttpMethod, url: string) =>
  (statusCode: number): string =>
    `${method.toUpperCase()} ${url} - ${statusCode}`
