import { pipe } from 'fp-ts/function'

import { DayJs } from '../../../shared/models/DayJs'
import { Future, toUnit } from '../../../shared/utils/fp'

import type { Migration } from '../../models/migration/Migration'
import type { MongoCollection } from '../../models/mongo/MongoCollection'

export const Migration202204011827 = (
  mongoCollection: (collName: string) => MongoCollection,
): Migration => ({
  createdAt: DayJs.of('2022-04-01T18:27:00Z'),
  migrate: pipe(
    mongoCollection('pollQuestion').future(coll =>
      coll.updateMany({}, { $set: { isAnonymous: true } }),
    ),
    Future.map(toUnit),
  ),
})
