import { Collection } from 'mongodb'

import { Future } from '../utils/fp'

export type MongoCollection = (
  collName: string,
) => <O, A>(f: (coll: Collection<O>) => Promise<A>) => Future<A>
