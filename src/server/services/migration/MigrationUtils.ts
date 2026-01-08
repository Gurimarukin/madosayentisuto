import { pipe } from 'fp-ts/function'
import { MongoServerError } from 'mongodb'

import type { Dict } from '../../../shared/utils/fp'
import { Future } from '../../../shared/utils/fp'

import type { MongoCollectionGetter } from '../../models/mongo/MongoCollection'

export const MigrationUtils = {
  dropCollection: (mongoCollection: MongoCollectionGetter, collName: string): Future<boolean> =>
    pipe(
      mongoCollection<Dict<string, never>>(collName).future(coll => coll.drop()),
      Future.orElse(e =>
        e instanceof MongoServerError && e.message === 'ns not found'
          ? Future.successful(true)
          : Future.failed(e),
      ),
    ),
}
