import { pipe } from 'fp-ts/function'
import type { Db, MongoClient } from 'mongodb'
import type { Readable } from 'stream'

import { TObservable } from '../../../shared/models/rx/TObservable'
import { Future, Try } from '../../../shared/utils/fp'

import { TObservableUtils } from '../../utils/TObservableUtils'

export type WithDb = {
  future: <A>(f: (db: Db) => Promise<A>) => Future<A>
  observable: (f: (db: Db) => Readable) => TObservable<unknown>
}

const of = (client: MongoClient, dbName: string): WithDb => ({
  future: f => Future.tryCatch(() => f(client.db(dbName))),

  observable: f => {
    const obs = pipe(
      Try.tryCatch(() => f(client.db(dbName))),
      Try.map(TObservableUtils.observableFromReadable),
      Try.getOrElseW(TObservable.throwError),
    )
    return TObservable.fromSubscribe(subscriber =>
      obs.subscribe({
        next: u => subscriber.next(u),
        error: e => subscriber.error(e),
        complete: () => subscriber.complete(),
      }),
    )
  },
})

export const WithDb = { of }
