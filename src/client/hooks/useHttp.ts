import type * as D from 'io-ts/Decoder'
import type { HttpMethod } from 'ky/distribution/types/options'
import type { SWRResponse } from 'swr'
import useSWR from 'swr'

import type { Tuple } from '../../shared/utils/fp'

import type { HttpOptions } from '../utils/http'
import { http } from '../utils/http'

// only changes of method and url will trigger revalidation
export const useHttp = <A, O, B>(
  methodWithUrl: Tuple<HttpMethod, string>,
  options: HttpOptions<O, B>,
  decoderWithName: Tuple<D.Decoder<unknown, A>, string>,
): SWRResponse<A, unknown> =>
  useSWR<A, unknown, Tuple<HttpMethod, string>>(methodWithUrl, (method, url) =>
    http([method, url], options, decoderWithName),
  )
