import type { Collection } from 'mongodb'
import type { Readable } from 'stream'

import type { Future } from '../../../shared/utils/fp'

import type { TObservable } from '../rx/TObservable'
import type { WithDb } from './WithDb'

export type MongoCollection = {
  readonly future: <O, A>(f: (coll: Collection<O>) => Promise<A>) => Future<A>
  readonly observable: <O>(f: (coll: Collection<O>) => Readable) => TObservable<unknown>
}

export const MongoCollection = {
  fromWithDb:
    (withDb: WithDb) =>
    (collName: string): MongoCollection => ({
      future: f => withDb.future(db => f(db.collection(collName))),
      observable: f => withDb.observable(db => f(db.collection(collName))),
    }),
}
