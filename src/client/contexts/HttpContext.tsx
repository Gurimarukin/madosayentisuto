/* eslint-disable functional/no-expression-statements */
import { flow, pipe } from 'fp-ts/function'
import type { Decoder } from 'io-ts/Decoder'
import type { Encoder } from 'io-ts/Encoder'
import type { Options as KYOptions } from 'ky'
import ky, { HTTPError } from 'ky'
import { createContext, useCallback, useContext } from 'react'

import type { HttpMethod } from '../../shared/models/HttpMethod'
import type { Tuple } from '../../shared/utils/fp'
import { Either } from '../../shared/utils/fp'
import { decodeError } from '../../shared/utils/ioTsUtils'

import { config } from '../config/unsafe'
import type { ChildrenFC } from '../model/ChildrenFC'
import { appRoutes } from '../router/AppRouter'
import { useHistory } from './HistoryContext'

export type HttpContext = {
  http: {
    <O, B>(methodWithUrl: Tuple<string, HttpMethod>, options?: HttpOptions<O, B>): Promise<unknown>
    <A, O, B>(
      methodWithUrl: Tuple<string, HttpMethod>,
      options: HttpOptions<O, B>,
      decoderWithName: Tuple<Decoder<unknown, A>, string>,
    ): Promise<A>
  }
}

export type HttpOptions<O, B> = Omit<KYOptions, 'method' | 'json'> & {
  json?: Tuple<Encoder<O, B>, B>
  redirectToLoginOnUnauthorized?: boolean // default: true
}

const HttpContext = createContext<HttpContext | undefined>(undefined)

export const HttpContextProvider: ChildrenFC = ({ children }) => {
  const { navigate } = useHistory()

  const http = useCallback(
    function <A, O, B>(
      [url, method]: Tuple<string, HttpMethod>,
      { credentials, redirectToLoginOnUnauthorized = true, ...options }: HttpOptions<O, B> = {},
      decoderWithName?: Tuple<Decoder<unknown, A>, string>,
    ): Promise<A> {
      const json = ((): O | undefined => {
        if (options.json === undefined) return undefined
        const [encoder, b] = options.json
        return encoder.encode(b)
      })()
      const res = ky(new URL(url, config.apiHost), {
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

      return redirectToLoginOnUnauthorized
        ? res.catch(e =>
            e instanceof HTTPError
              ? ((): Promise<never> => {
                  if (e.response.status === 401) navigate(appRoutes.login)
                  return Promise.reject(e)
                })()
              : Promise.reject(e),
          )
        : res
    },
    [navigate],
  )

  const value: HttpContext = { http }

  return <HttpContext.Provider value={value}>{children}</HttpContext.Provider>
}

export const useHttp = (): HttpContext => {
  const context = useContext(HttpContext)
  if (context === undefined) {
    // eslint-disable-next-line functional/no-throw-statements
    throw Error('useHttp must be used within a HttpContextProvider')
  }
  return context
}
