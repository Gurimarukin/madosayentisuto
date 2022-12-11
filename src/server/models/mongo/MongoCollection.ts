import type { Collection, Document as MongoDocument } from 'mongodb'
import type { Readable } from 'stream'

import type { TObservable } from '../../../shared/models/rx/TObservable'
import type { Future } from '../../../shared/utils/fp'

import type { WithDb } from './WithDb'

export type MongoCollection<O extends MongoDocument> = {
  readonly future: <A>(f: (coll: Collection<O>) => Promise<A>) => Future<A>
  readonly observable: (f: (coll: Collection<O>) => Readable) => TObservable<unknown>
}

type MongoCollectionGetter = <O extends MongoDocument>(collName: string) => MongoCollection<O>

const MongoCollectionGetter = {
  fromWithDb:
    (withDb: WithDb): MongoCollectionGetter =>
    collName => ({
      future: f => withDb.future(db => f(db.collection(collName))),
      observable: f => withDb.observable(db => f(db.collection(collName))),
    }),
}

export { MongoCollectionGetter }
