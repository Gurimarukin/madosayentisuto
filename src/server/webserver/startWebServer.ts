import type { ErrorRequestHandler } from 'express'
import express from 'express'
import { task } from 'fp-ts'
import { list } from 'fp-ts-contrib'
import type { Task } from 'fp-ts/Task'
import { flow, pipe } from 'fp-ts/function'
import type { ResponseEnded } from 'hyper-ts'
import { Status } from 'hyper-ts'
import type { Action, ExpressConnection } from 'hyper-ts/lib/express'
import { toRequestHandler } from 'hyper-ts/lib/express'

import type { NonEmptyArray } from '../../shared/utils/fp'
import { Dict, Either, Future, IO, List, Maybe } from '../../shared/utils/fp'

import type { HttpConfig } from '../Config'
import type { EndedMiddleware } from '../models/EndedMiddleware'
import { EndendMiddleware } from '../models/EndedMiddleware'
import type { Route } from '../models/Route'
import type { LoggerGetter, LoggerType } from '../models/logger/LoggerType'

const allowedHeaders = ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization']

export const startWebServer = (
  Logger: LoggerGetter,
  config: HttpConfig,
  routes: List<Route>,
): IO<void> => {
  const logger = Logger('WebServer')

  const withCors = pipe(
    IO.tryCatch(() => express()),
    IO.chain(app =>
      pipe(
        config.allowedOrigins,
        Maybe.fold(
          () => IO.tryCatch(() => app),
          allowedOrigins =>
            IO.tryCatch(() =>
              app.use((req, res, next) =>
                pipe(
                  Dict.lookup('origin', req.headers),
                  Maybe.filter(containedIn(allowedOrigins)),
                  Maybe.fold(
                    () => next(),
                    origin => {
                      /* eslint-disable functional/no-expression-statement */
                      res.append('Access-Control-Allow-Origin', origin)
                      res.header('Access-Control-Allow-Headers', allowedHeaders.join(', '))
                      if (req.method === 'OPTIONS') res.send()
                      else next()
                      /* eslint-enable functional/no-expression-statement */
                    },
                  ),
                ),
              ),
            ),
        ),
      ),
    ),
  )

  return pipe(
    routes,
    List.reduce(withCors, (ioApp, [method, path, middleware]) =>
      pipe(
        ioApp,
        IO.chain(app =>
          IO.tryCatch(() =>
            app[method](path, pipe(middleware, withTry, withLog, toRequestHandler)),
          ),
        ),
      ),
    ),
    IO.chain(e =>
      IO.tryCatch(() =>
        e.use(pipe(EndendMiddleware.text(Status.NotFound)(), withLog, toRequestHandler)),
      ),
    ),
    IO.chain(e => IO.tryCatch(() => e.use(errorHandler(onError)))),
    IO.chain(e =>
      IO.tryCatch(() =>
        e.listen(config.port, logger.info(`Server listening on port ${config.port}`)),
      ),
    ),
    IO.map(() => {}),
  )

  function withLog(middleware: EndedMiddleware): EndedMiddleware {
    return conn =>
      pipe(
        middleware(conn),
        task.chain(res =>
          pipe(
            res,
            Either.fold(
              () => task.of(undefined),
              ([, c]) => logConnection(logger, c as ExpressConnection<ResponseEnded>),
            ),
            task.map(() => res),
          ),
        ),
      )
  }

  function withTry(middleware: EndedMiddleware): EndedMiddleware {
    return conn =>
      pipe(
        Future.tryCatch(() => middleware(conn)()),
        task.chain(
          Either.fold(
            flow(
              onError,
              task.fromIO,
              task.chain(() => EndendMiddleware.text(Status.InternalServerError)()(conn)),
            ),
            task.of,
          ),
        ),
      )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onError(error: any): IO<void> {
    return error.stack === undefined ? logger.error(error) : logger.error(error.stack)
  }
}

const containedIn =
  <A>(allowedOrigins: NonEmptyArray<A>) =>
  <B>(elem: A | B): elem is A =>
    pipe(
      allowedOrigins,
      List.some(a => a === elem),
    )

const logConnection = (
  logger: LoggerType,
  conn: ExpressConnection<ResponseEnded>,
): Task<unknown> => {
  const method = conn.getMethod()
  const uri = conn.getOriginalUrl()
  const status = pipe(
    conn,
    getStatus,
    Maybe.map(s => s.toString()),
    Maybe.toArray,
  )
  return task.fromIO(logger.debug(method, uri, '-', ...status))
}

const getStatus = (conn: ExpressConnection<ResponseEnded>): Maybe<Status> =>
  pipe(
    conn.actions,
    list.toArray,
    List.findLast(isSetStatus),
    Maybe.map(({ status }) => status),
  )

type SetStatus = {
  readonly type: 'setStatus'
  readonly status: Status
}

const isSetStatus = (a: Action): a is SetStatus => a.type === 'setStatus'

const errorHandler =
  (onError: (error: unknown) => IO<unknown>): ErrorRequestHandler =>
  (err, _req, res) => {
    /* eslint-disable functional/no-expression-statement */
    onError(err)()
    res.status(500).end()
    /* eslint-enable functional/no-expression-statement */
  }
