import type { Collection } from 'mongodb'
import type { Readable } from 'stream'

import type { TObservable } from '../../../shared/models/rx/TObservable'
import type { Future } from '../../../shared/utils/fp'

import type { WithDb } from './WithDb'

export type MongoCollection<O> = {
  readonly future: <A>(f: (coll: Collection<O>) => Promise<A>) => Future<A>
  readonly observable: (f: (coll: Collection<O>) => Readable) => TObservable<unknown>
}

export type MongoCollectionGetter = <O>(collName: string) => MongoCollection<O>

export const MongoCollectionGetter = {
  fromWithDb:
    (withDb: WithDb): MongoCollectionGetter =>
    collName => ({
      future: f => withDb.future(db => f(db.collection(collName))),
      observable: f => withDb.observable(db => f(db.collection(collName))),
    }),
}
