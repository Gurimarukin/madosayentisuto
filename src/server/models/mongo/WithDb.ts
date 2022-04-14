import { task } from 'fp-ts'
import { pipe } from 'fp-ts/function'
import type { Db } from 'mongodb'
import { MongoClient } from 'mongodb'
import type { Readable } from 'stream'

import { Future, Try } from '../../../shared/utils/fp'

import type { LoggerType } from '../logger/LoggerType'
import { TObservable } from '../rx/TObservable'

export type WithDb = {
  readonly future: <A>(f: (db: Db) => Promise<A>) => Future<A>
  readonly observable: (f: (db: Db) => Readable) => TObservable<unknown>
}

type Of = {
  readonly logger: LoggerType
  readonly url: string
  readonly dbName: string
}

const of = ({ logger, url, dbName }: Of): WithDb => ({
  future: f =>
    pipe(
      Future.tryCatch(() => MongoClient.connect(url)),
      Future.chain(client =>
        pipe(
          Future.tryCatch(() => f(client.db(dbName))),
          task.chainFirst(() =>
            // close client, even if f threw an error
            clientClose(logger, client),
          ),
        ),
      ),
    ),

  observable: f =>
    pipe(
      Future.tryCatch(() => MongoClient.connect(url)),
      Future.map(client => {
        const obs = pipe(
          Try.tryCatch(() => f(client.db(dbName))),
          Try.map(TObservable.fromReadable),
          Try.getOrElseW(TObservable.throwError),
        )
        return TObservable.fromSubscribe(subscriber =>
          obs.subscribe({
            next: u => subscriber.next(u),
            error: e =>
              pipe(
                clientClose(logger, client),
                Future.map(() => subscriber.error(e)),
                Future.orElse(err => Future.right(subscriber.error(err))), // clientClose failed (very unlikely)
                Future.runUnsafe,
              ),
            complete: () =>
              pipe(
                clientClose(logger, client),
                Future.map(() => subscriber.complete()),
                Future.orElse(err => Future.right(subscriber.error(err))), // clientClose failed (very unlikely)
                Future.runUnsafe,
              ),
          }),
        )
      }),
      TObservable.fromTaskEither,
      TObservable.flatten,
    ),
})

const clientClose = (logger: LoggerType, client: MongoClient): Future<void> =>
  pipe(
    Future.tryCatch(() => client.close()),
    Future.orElse(e => Future.fromIOEither(logger.error('Failed to close client:\n', e))),
  )

export const WithDb = { of }
