import type { ErrorRequestHandler } from 'express'
import express from 'express'
import { list } from 'fp-ts-contrib'
import type { Parser } from 'fp-ts-routing'
import { Route as FpTsRoute, parse, zero } from 'fp-ts-routing'
import { flow, identity, pipe } from 'fp-ts/function'
import type * as http from 'http'
import { Status } from 'hyper-ts'
import type { ExpressConnection } from 'hyper-ts/lib/express'

import { Method } from '../../shared/models/Method'
import type { NotUsed } from '../../shared/utils/fp'
import {
  Dict,
  Either,
  Future,
  IO,
  List,
  Maybe,
  NonEmptyArray,
  Try,
  toNotUsed,
} from '../../shared/utils/fp'

import type { HttpConfig } from '../config/Config'
import type { LoggerGetter } from '../models/logger/LoggerObservable'
import { getOnError } from '../utils/getOnError'
import type { EndedMiddleware, MyMiddleware } from './models/MyMiddleware'
import { MyMiddleware as M } from './models/MyMiddleware'
import type { RouteMiddleware, RouteUpgrade } from './models/Route'
import { Route } from './models/Route'
import { SimpleHttpResponse } from './models/SimpleHttpResponse'
import { UpgradeHandler } from './models/UpgradeHandler'

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
): IO<NotUsed> => {
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
      logger.trace(
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

  const altedMiddlewareRoutes = pipe(
    routes,
    List.filter(Route.is('Middleware')),
    getAltedMiddlewareRoutes,
  )
  const altedUpgradeRoutes = pipe(routes, List.filter(Route.is('Upgrade')), getAltedUpgradeRoutes)

  return pipe(
    Method.values,
    List.reduce(withCors, bindMiddlewares),
    IO.chain(e => IO.tryCatch(() => e.use(errorHandler(onError)))),
    IO.chain(e =>
      IO.tryCatch(() =>
        e.listen(config.port, logger.info(`Server listening on port ${config.port}`)),
      ),
    ),
    IO.chain(bindUpgrades),
    IO.map(toNotUsed),
  )

  function bindMiddlewares(ioApp: IO<express.Express>, method: Method): IO<express.Express> {
    return pipe(
      ioApp,
      IO.chain(app =>
        IO.tryCatch(() =>
          app[method]('*', (req, res, next) => {
            const handler = pipe(
              parse<EndedMiddleware>(
                altedMiddlewareRoutes[method],
                FpTsRoute.parse(req.url),
                M.sendWithStatus(Status.NotFound)(''),
              ),
              M.orElse(handleErrorMiddleware),
              logMiddleware,
              M.toRequestHandler,
            )
            return handler(req, res, next)
          }),
        ),
      ),
    )
  }

  function bindUpgrades(server: http.Server): IO<http.Server> {
    return IO.tryCatch(() =>
      server.on('upgrade', (request, socket, head) =>
        pipe(
          request.url,
          Try.fromNullable(Error(`request.url was ${request.url}`)),
          Future.fromEither,
          Future.chain(url => {
            const handler = pipe(
              parse<UpgradeHandler>(
                altedUpgradeRoutes,
                FpTsRoute.parse(url),
                UpgradeHandler.NotFound,
              ),
            )
            return handler(request, socket, head)
          }),
          Future.orElse<Error, Either<SimpleHttpResponse, void>, Error>(handleErrorUpgrade),
          Future.map(Either.getOrElse(res => socket.end(SimpleHttpResponse.toRawHttp(res)))),
          Future.map<void, NotUsed>(toNotUsed),
          Future.run(getOnError(logger)),
        ),
      ),
    )
  }

  function handleErrorMiddleware(e: Error): EndedMiddleware {
    return pipe(
      logger.error(e),
      M.fromIOEither,
      M.ichain(() => M.sendWithStatus(Status.InternalServerError)('')),
    )
  }

  function handleErrorUpgrade(e: Error): Future<Either<SimpleHttpResponse, never>> {
    return pipe(
      logger.error(e),
      IO.map(() => Either.left(SimpleHttpResponse.of(Status.InternalServerError, ''))),
      Future.fromIOEither,
    )
  }

  function logMiddleware<I, O>(middleware: MyMiddleware<I, O, void>): MyMiddleware<I, O, void> {
    return conn =>
      pipe(
        middleware(conn),
        Future.chainFirstIOEitherK(([, c]) => logConnection(c as ExpressConnection<O>)),
      )
  }

  function logConnection<A>(conn: ExpressConnection<A>): IO<NotUsed> {
    const method = conn.getMethod()
    const uri = conn.getOriginalUrl()
    const status = pipe(
      conn,
      getStatus,
      Maybe.map(s => s.toString()),
      Maybe.toUndefined,
    )
    return logger.trace(method, uri, '-', status)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onError(error: any): IO<NotUsed> {
    return logger.error(error.stack === undefined ? error : error.stack)
  }
}

const getAltedMiddlewareRoutes = (
  routes: List<RouteMiddleware>,
): Dict<Method, Parser<EndedMiddleware>> => {
  const init: Dict<Method, Parser<EndedMiddleware>> = pipe(
    Method.values,
    List.reduce({} as Dict<Method, Parser<EndedMiddleware>>, (acc, method) => ({
      ...acc,
      [method]: zero<EndedMiddleware>(),
    })),
  )
  return pipe(
    routes,
    List.reduce(init, (acc, { middleware: [method, parser] }) => ({
      ...acc,
      [method]: acc[method].alt(parser),
    })),
  )
}

const getAltedUpgradeRoutes = (routes: List<RouteUpgrade>): Parser<UpgradeHandler> =>
  pipe(
    routes,
    List.reduce(zero<UpgradeHandler>(), (acc, { upgrade: parser }) => acc.alt(parser)),
  )

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
