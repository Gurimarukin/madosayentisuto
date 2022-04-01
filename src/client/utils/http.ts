import { flow, pipe } from 'fp-ts/function'
import type { Decoder } from 'io-ts/Decoder'
import type { Encoder } from 'io-ts/Encoder'
import ky from 'ky'
import type { HttpMethod, Options } from 'ky/distribution/types/options'

import type { Tuple } from '../../shared/utils/fp'
import { Either } from '../../shared/utils/fp'
import { decodeError } from '../../shared/utils/ioTsUtils'

import { config } from '../config/unsafe'

export type HttpOptions<O, B> = Omit<Options, 'method' | 'json'> & {
  readonly json?: Tuple<Encoder<O, B>, B>
}

export function http<O, B>(
  methodWithUrl: Tuple<string, HttpMethod>,
  options?: HttpOptions<O, B>,
): Promise<unknown>
export function http<A, O, B>(
  methodWithUrl: Tuple<string, HttpMethod>,
  options: HttpOptions<O, B>,
  decoderWithName: Tuple<Decoder<unknown, A>, string>,
): Promise<A>
export function http<A, O, B>(
  [url, method]: Tuple<string, HttpMethod>,
  { credentials, ...options }: HttpOptions<O, B> = {},
  decoderWithName?: Tuple<Decoder<unknown, A>, string>,
): Promise<A> {
  const json = ((): O | undefined => {
    if (options.json === undefined) return undefined
    const [encoder, b] = options.json
    return encoder.encode(b)
  })()
  return ky(new URL(url, config.apiHost), {
    ...options,
    method,
    json,
    credentials: credentials === undefined ? 'include' : credentials,
  })
    .json()
    .then(u => {
      if (decoderWithName === undefined) return Promise.resolve(u as A)
      const [decoder, decoderName] = decoderWithName
      return pipe(
        decoder.decode(u),
        Either.fold(
          flow(decodeError(decoderName)(u), error => {
            console.error(error)
            return Promise.reject(error)
          }),
          a => Promise.resolve(a),
        ),
      )
    })
}
