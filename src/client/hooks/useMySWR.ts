import type { Decoder } from 'io-ts/Decoder'
import type { HttpMethod } from 'ky/distribution/types/options'
import type { SWRResponse } from 'swr'
import useSWR from 'swr'

import type { Tuple, Tuple3 } from '../../shared/utils/fp'

import type { HttpOptions } from '../contexts/HttpContext'
import { useHttp } from '../contexts/HttpContext'

// only changes of method and url will trigger revalidation
export const useMySWR = <A, O, B>(
  methodWithUrl: Tuple<string, HttpMethod>,
  options: Omit<HttpOptions<O, B>, 'redirectOnUnauthorized'>,
  decoderWithName: Tuple<Decoder<unknown, A>, string>,
): SWRResponse<A, unknown> => {
  const { http } = useHttp()
  return useSWR<A, unknown, Tuple3<string, HttpMethod, typeof http>>(
    [...methodWithUrl, http],
    (method, url, http_) => http_([method, url], { ...options }, decoderWithName),
  )
}
