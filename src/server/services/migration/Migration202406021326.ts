import { pipe } from 'fp-ts/function'

import { DayJs } from '../../../shared/models/DayJs'
import { Future, toNotUsed } from '../../../shared/utils/fp'

import type { Migration } from '../../models/migration/Migration'
import type { MongoCollectionGetter } from '../../models/mongo/MongoCollection'
import { MigrationUtils } from './MigrationUtils'

export function Migration202406021326(mongoCollection: MongoCollectionGetter): Migration {
  return {
    createdAt: DayJs.of('2024-06-02T13:26:00Z'),
    migrate: pipe(
      MigrationUtils.dropCollection(mongoCollection, 'theQuestProgression'),
      Future.map(toNotUsed),
    ),
  }
}
