import type { ErrorRequestHandler } from 'express'
import express from 'express'
import { list } from 'fp-ts-contrib'
import type { Parser } from 'fp-ts-routing'
import { parse } from 'fp-ts-routing'
import { Route as FpTsRoute, zero } from 'fp-ts-routing'
import { flow, identity, pipe } from 'fp-ts/function'
import { Status } from 'hyper-ts'
import type { ExpressConnection } from 'hyper-ts/lib/express'

import { Method } from '../../shared/models/Method'
import { Dict, Future, IO, List, Maybe, NonEmptyArray, toUnit } from '../../shared/utils/fp'

import type { HttpConfig } from '../Config'
import type { LoggerGetter } from '../models/logger/LoggerGetter'
import type { EndedMiddleware, MyMiddleware } from './models/MyMiddleware'
import { MyMiddleware as M } from './models/MyMiddleware'
import type { Route } from './models/Route'

const accessControl = {
  allowCredentials: true,
  allowMethods: ['GET', 'POST', 'DELETE'],
  allowHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
  exposeHeaders: ['Set-Cookie'],
}

// eslint-disable-next-line functional/prefer-readonly-type
type Header = string | string[] | undefined

export const startWebServer = (
  Logger: LoggerGetter,
  config: HttpConfig,
  routes: List<Route>,
): IO<void> => {
  const logger = Logger('WebServer')

  const filterOrigin: (fa: Maybe<Header>) => Maybe<Header> = pipe(
    config.allowedOrigins,
    Maybe.fold(
      () => identity,
      allowedOrigins =>
        Maybe.filter(origin =>
          pipe(
            allowedOrigins,
            List.some(allowedOrigin => allowedOrigin.origin === origin),
          ),
        ),
    ),
  )

  const withCors: IO<express.Express> = pipe(
    IO.tryCatch(() => express()),
    IO.chainFirst(() =>
      logger.debug(
        `HTTP_ALLOWED_ORIGINS: ${pipe(
          config.allowedOrigins,
          Maybe.map(
            flow(
              NonEmptyArray.map(u => u.origin),
              List.mkString(', '),
            ),
          ),
          Maybe.toNullable,
        )}`,
      ),
    ),
    IO.chain(app =>
      IO.tryCatch(() =>
        app.use((req, res, next) =>
          pipe(
            req.headers,
            Dict.lookup('origin'),
            u => filterOrigin(u),
            Maybe.fold(next, origin => {
              /* eslint-disable functional/no-expression-statement */
              res.header({
                'Access-Control-Allow-Origin': origin,
                ...(accessControl.allowCredentials
                  ? { 'Access-Control-Allow-Credentials': true }
                  : {}),
                'Access-Control-Expose-Headers': headers(accessControl.exposeHeaders),
              })
              if (req.method === 'OPTIONS') {
                res
                  .header({
                    'Access-Control-Allow-Methods': headers(accessControl.allowMethods),
                    'Access-Control-Allow-Headers': headers(accessControl.allowHeaders),
                  })
                  .send()
              } else {
                next()
              }
              /* eslint-enable functional/no-expression-statement */
            }),
          ),
        ),
      ),
    ),
  )

  const altedRoutes = getAltedRoutes(routes)

  return pipe(
    Method.values,
    List.reduce(withCors, (ioApp, method) =>
      pipe(
        ioApp,
        IO.chain(app =>
          IO.tryCatch(() =>
            app[method]('*', (req, res, next) =>
              pipe(
                parse<EndedMiddleware>(
                  altedRoutes[method],
                  FpTsRoute.parse(req.url),
                  M.sendWithStatus(Status.NotFound)(''),
                ),
                M.orElse(handleError),
                logMiddleware,
                M.toRequestHandler,
              )(req, res, next),
            ),
          ),
        ),
      ),
    ),
    IO.chain(e => IO.tryCatch(() => e.use(errorHandler(onError)))),
    IO.chain(e =>
      IO.tryCatch(() =>
        e.listen(config.port, logger.info(`Server listening on port ${config.port}`)),
      ),
    ),
    IO.map(toUnit),
  )

  function handleError(e: Error): EndedMiddleware {
    return pipe(
      logger.error(e),
      M.fromIOEither,
      M.ichain(() => M.sendWithStatus(Status.InternalServerError)('')),
    )
  }

  function logMiddleware<I, O>(middleware: MyMiddleware<I, O, void>): MyMiddleware<I, O, void> {
    return conn =>
      pipe(
        middleware(conn),
        Future.chainFirstIOEitherK(([, c]) => logConnection(c as ExpressConnection<O>)),
      )
  }

  function logConnection<A>(conn: ExpressConnection<A>): IO<void> {
    const method = conn.getMethod()
    const uri = conn.getOriginalUrl()
    const status = pipe(
      conn,
      getStatus,
      Maybe.map(s => s.toString()),
      Maybe.toUndefined,
    )
    return logger.debug(method, uri, '-', status)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onError(error: any): IO<void> {
    return error.stack === undefined ? logger.error(error) : logger.error(error.stack)
  }
}

const getAltedRoutes = (routes: List<Route>): Dict<Method, Parser<EndedMiddleware>> => {
  const init: Dict<Method, Parser<EndedMiddleware>> = pipe(
    Method.values,
    List.reduce({} as Dict<Method, Parser<EndedMiddleware>>, (acc, method) => ({
      ...acc,
      [method]: zero<EndedMiddleware>(),
    })),
  )
  return pipe(
    routes,
    List.reduce(init, (acc, [method, parser]) => ({ ...acc, [method]: acc[method].alt(parser) })),
  )
}

const getStatus = <A>(conn: ExpressConnection<A>): Maybe<Status> =>
  pipe(
    conn.actions,
    list.toArray,
    List.findLastMap(a => (a.type === 'setStatus' ? Maybe.some(a.status) : Maybe.none)),
  )

const errorHandler =
  (onError: (error: unknown) => IO<unknown>): ErrorRequestHandler =>
  (err, _req, res) => {
    /* eslint-disable functional/no-expression-statement */
    onError(err)()
    res.status(500).end()
    /* eslint-enable functional/no-expression-statement */
  }

const headers = (values: List<string>): string => pipe(values, List.mkString(', '))
