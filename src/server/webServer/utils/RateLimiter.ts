import { apply, eq, ord, string } from 'fp-ts'
import type { Eq } from 'fp-ts/Eq'
import { pipe } from 'fp-ts/function'
import type { StatusOpen } from 'hyper-ts'
import { Status } from 'hyper-ts'

import { DayJs } from '../../../shared/models/DayJs'
import { MsDuration } from '../../../shared/models/MsDuration'
import { List, Maybe, Tuple } from '../../../shared/utils/fp'

import type { LoggerGetter } from '../../models/logger/LoggerObservable'
import type { EndedMiddleware } from '../models/MyMiddleware'
import { MyMiddleware as M } from '../models/MyMiddleware'
import type { WithIp } from './WithIp'

type RateLimiter = (
  limit: number,
  window: MsDuration,
) => (middleware: EndedMiddleware) => EndedMiddleware

const RateLimiter = (Logger: LoggerGetter, withIp: WithIp, lifeTime: MsDuration): RateLimiter => {
  const logger = Logger('RateLimiter')

  // eslint-disable-next-line functional/no-let
  let requests: List<RequestsHistory> = []

  /* eslint-disable functional/no-expression-statements */
  setTimeout(() => {
    requests = []
    setInterval(() => (requests = []), MsDuration.unwrap(lifeTime))
  }, MsDuration.unwrap(lifeTime))
  /* eslint-enable functional/no-expression-statements */

  return (limit, window) => middleware =>
    withIp('route with rate limiting')(ip =>
      pipe(
        apply.sequenceS(M.ApplyPar)({
          now: M.fromIO<DayJs, StatusOpen>(DayJs.now),
          url: M.getUrl(),
        }),
        M.ichain(({ now, url }) => {
          const key = Key.of(url, ip)
          const windowStart = pipe(now, DayJs.subtract(window))

          const [newRequests, result] = pipe(
            // : Tuple<List<RequestsHistory>, EndedMiddleware>
            requests,
            List.findIndex(r => Key.Eq.equals(r.key, key)),
            Maybe.fold(
              () => Tuple.of([RequestsHistory.of(key, [now])], middleware),
              i => {
                const { history } = requests[i] as RequestsHistory
                const cleaned = pipe(
                  history,
                  List.filter(h => ord.lt(DayJs.Ord)(windowStart, h)),
                )

                if (limit <= cleaned.length) {
                  return Tuple.of(
                    requests,
                    pipe(
                      logger.warn(`Too many request on route "${url}" with ip "${ip}"`),
                      M.fromIOEither,
                      M.ichain(() => M.sendWithStatus(Status.Unauthorized)('Too many requests')),
                    ),
                  )
                }

                const newHistory = RequestsHistory.of(key, pipe(cleaned, List.append(now)))
                return Tuple.of(List.unsafeUpdateAt(i, newHistory, requests), middleware)
              },
            ),
          )

          // eslint-disable-next-line functional/no-expression-statements
          requests = newRequests

          return result
        }),
      ),
    )
}

export { RateLimiter }

type RequestsHistory = {
  key: Key
  history: List<DayJs>
}

const RequestsHistory = {
  of: (key: Key, history: List<DayJs>): RequestsHistory => ({ key, history }),
}

type Key = {
  url: string
  ip: string
}

const keyEq: Eq<Key> = eq.struct({
  url: string.Eq,
  ip: string.Eq,
})

const Key = {
  of: (url: string, ip: string): Key => ({ url, ip }),
  Eq: keyEq,
}
