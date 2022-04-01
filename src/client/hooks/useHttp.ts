/* eslint-disable functional/no-expression-statement */
import type { Decoder } from 'io-ts/Decoder'
import { HTTPError } from 'ky'
import type { HttpMethod } from 'ky/distribution/types/options'
import type { SWRResponse } from 'swr'
import useSWR from 'swr'

import type { Tuple } from '../../shared/utils/fp'

import { appRoutes } from '../router/AppRouter'
import { useHistory } from '../router/HistoryContext'
import type { HttpOptions } from '../utils/http'
import { http } from '../utils/http'

// only changes of method and url will trigger revalidation
export const useHttp = <A, O, B>(
  methodWithUrl: Tuple<string, HttpMethod>,
  options: HttpOptions<O, B>,
  decoderWithName: Tuple<Decoder<unknown, A>, string>,
): SWRResponse<A, unknown> => {
  const { navigate } = useHistory()

  return useSWR<A, unknown, Tuple<string, HttpMethod>>(methodWithUrl, (method, url) =>
    http([method, url], options, decoderWithName).catch(e =>
      e instanceof HTTPError
        ? ((): Promise<never> => {
            if (e.response.status === 401) navigate(appRoutes.login)
            return Promise.reject(e)
          })()
        : Promise.reject(e),
    ),
  )
}
