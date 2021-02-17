import { Collection } from 'mongodb'

import { Future } from '../utils/fp'

export type MongoCollection = (
  collName: string,
) => <A>(f: (coll: Collection) => Promise<A>) => Future<A>
