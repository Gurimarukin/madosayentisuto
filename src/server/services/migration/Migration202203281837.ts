import { pipe } from 'fp-ts/function'

import { DayJs } from '../../../shared/models/DayJs'
import { Future, toUnit } from '../../../shared/utils/fp'

import type { Migration } from '../../models/migration/Migration'
import type { MongoCollection } from '../../models/mongo/MongoCollection'

export const Migration202203281837 = (
  mongoCollection: (collName: string) => MongoCollection,
): Migration => ({
  createdAt: DayJs.of('2022-03-28T18:37:00Z'),
  migrate: pipe(
    mongoCollection('pollResponse').future(coll => coll.drop()),
    Future.map(toUnit),
  ),
})
