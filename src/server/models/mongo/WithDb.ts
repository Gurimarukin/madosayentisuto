import type { io } from 'fp-ts'
import { task } from 'fp-ts'
import { pipe } from 'fp-ts/function'
import type { Db } from 'mongodb'
import { MongoClient } from 'mongodb'
import type { Readable } from 'stream'

import { TObservable } from '../../../shared/models/rx/TObservable'
import type { NotUsed } from '../../../shared/utils/fp'
import { Future, Try, toNotUsed } from '../../../shared/utils/fp'

import { TObservableUtils } from '../../utils/TObservableUtils'

export type WithDb = {
  future: <A>(f: (db: Db) => Promise<A>) => Future<A>
  observable: (f: (db: Db) => Readable) => TObservable<unknown>
}

type Of = {
  url: string
  username?: string
  password?: string
  dbName: string
}

const of = (
  onError: (e: Error) => io.IO<NotUsed>,
  { url, username, password, dbName }: Of,
): WithDb => {
  const mongoClient: Future<MongoClient> = Future.tryCatch(() =>
    MongoClient.connect(url, { auth: { username, password } }),
  )

  return {
    future: f =>
      pipe(
        mongoClient,
        Future.chain(client =>
          pipe(
            Future.tryCatch(() => f(client.db(dbName))),
            task.chainFirst(() =>
              // close client, even if f threw an error
              Future.tryCatch(() => client.close()),
            ),
          ),
        ),
      ),

    observable: f =>
      pipe(
        mongoClient,
        Future.map(client => {
          const obs = pipe(
            Try.tryCatch(() => f(client.db(dbName))),
            Try.map(TObservableUtils.observableFromReadable),
            Try.getOrElseW(TObservable.throwError),
          )
          return TObservable.fromSubscribe(subscriber => {
            return obs.subscribe({
              next: u => subscriber.next(u),
              error: e => close(() => subscriber.error(e)),
            })

            // eslint-disable-next-line functional/no-return-void
            function close(afterClose: () => void): Promise<NotUsed> {
              return pipe(
                Future.tryCatch(() => client.close()),
                Future.map(() => afterClose()),
                Future.orElse(err => Future.successful(subscriber.error(err))), // clientClose failed (very unlikely)
                Future.map<void, NotUsed>(toNotUsed),
                Future.run(onError),
              )
            }
          })
        }),
        TObservable.fromTaskEither,
        TObservable.flatten,
      ),
  }
}

export const WithDb = { of }
