import { pipe } from 'fp-ts/function'
import type { Decoder } from 'io-ts/Decoder'
import type { Options } from 'ky'
import ky from 'ky'
import type { HttpMethod } from 'ky/distribution/types/options'
import type { SWRResponse } from 'swr'
import useSWR from 'swr'

import { decodeError } from '../../shared/utils/decodeError'
import type { Tuple } from '../../shared/utils/fp'
import { Either } from '../../shared/utils/fp'

type MyOptions = Omit<Options, 'method'>

// only changes of method and url will trigger revalidation
export const useHttp = <A>(
  method: HttpMethod,
  url: string,
  options: MyOptions,
  [decoder, decoderName]: Tuple<Decoder<unknown, A>, string>,
): SWRResponse<A, unknown> =>
  useSWR<A, unknown, Tuple<HttpMethod, string>>([method, url], (url_, method_) =>
    ky(url_, { ...options, method: method_ })
      .json()
      .then(u =>
        pipe(
          decoder.decode(u),
          Either.fold(
            e => {
              const error = pipe(e, decodeError(decoderName)(u))
              console.error(error)
              // eslint-disable-next-line functional/no-promise-reject
              return Promise.reject(error)
            },
            a => Promise.resolve(a),
          ),
        ),
      ),
  )
