import { Collection } from 'mongodb'

import { FpCollection } from './FpCollection'
import { Referential } from '../models/referential/Referential'
import { Future, pipe, Maybe } from '../utils/fp'
import { PartialLogger } from '../services/Logger'

export type ReferentialPersistence = ReturnType<typeof ReferentialPersistence>

export const ReferentialPersistence = (
  Logger: PartialLogger,
  mongoCollection: (dbName: string) => Future<Collection>
) => {
  const logger = Logger('ReferentialPersistence')

  const collection = FpCollection(logger, () => mongoCollection('referential'), Referential.codec)

  const get = (): Future<Maybe<Referential>> => collection.findOne({})

  const set = (referential: Referential): Future<boolean> =>
    pipe(
      collection.findOne({}),
      Future.chain(
        Maybe.fold(
          () =>
            pipe(
              collection.insertOne(referential),
              Future.map(_ => _.insertedCount === 1)
            ),
          _ =>
            pipe(
              collection.replaceOne({}, referential, { upsert: true }),
              Future.map(_ => _.upsertedCount === 1)
            )
        )
      )
    )

  return { get, set }
}
