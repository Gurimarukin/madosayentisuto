import { task } from 'fp-ts'
import { pipe } from 'fp-ts/function'
import type { Db } from 'mongodb'
import { MongoClient } from 'mongodb'
import type { Readable } from 'stream'

import { TObservable } from '../../../shared/models/rx/TObservable'
import { Future, Try } from '../../../shared/utils/fp'

import { TObservableUtils } from '../../utils/TObservableUtils'

export type WithDb = {
  readonly future: <A>(f: (db: Db) => Promise<A>) => Future<A>
  readonly observable: (f: (db: Db) => Readable) => TObservable<unknown>
}

type Of = {
  readonly url: string
  readonly dbName: string
}

const of = ({ url, dbName }: Of): WithDb => ({
  future: f =>
    pipe(
      Future.tryCatch(() => MongoClient.connect(url)),
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
      Future.tryCatch(() => MongoClient.connect(url)),
      Future.map(client => {
        const obs = pipe(
          Try.tryCatch(() => f(client.db(dbName))),
          Try.map(TObservableUtils.observableFromReadable),
          Try.getOrElseW(TObservable.throwError),
        )
        return TObservable.fromSubscribe(subscriber =>
          obs.subscribe({
            next: u => subscriber.next(u),
            error: e =>
              pipe(
                Future.tryCatch(() => client.close()),
                Future.map(() => subscriber.error(e)),
                Future.orElse(err => Future.right(subscriber.error(err))), // clientClose failed (very unlikely)
                Future.runUnsafe,
              ),
            complete: () =>
              pipe(
                Future.tryCatch(() => client.close()),
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

export const WithDb = { of }
