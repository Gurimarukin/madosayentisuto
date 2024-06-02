import { pipe } from 'fp-ts/function'

import { DayJs } from '../../../shared/models/DayJs'
import { Future, toNotUsed } from '../../../shared/utils/fp'

import type { Migration } from '../../models/migration/Migration'
import type { MongoCollectionGetter } from '../../models/mongo/MongoCollection'

export function Migration202406021326(mongoCollection: MongoCollectionGetter): Migration {
  return {
    createdAt: DayJs.of('2024-06-02T13:26:00Z'),
    migrate: pipe(
      mongoCollection('theQuestProgression').future(coll => coll.drop()),
      Future.map(toNotUsed),
    ),
  }
}
