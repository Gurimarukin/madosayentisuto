import type { Collection } from 'mongodb'

import type { Future } from '../../shared/utils/fp'

export type MongoCollection = (
  collName: string,
) => <O, A>(f: (coll: Collection<O>) => Promise<A>) => Future<A>
