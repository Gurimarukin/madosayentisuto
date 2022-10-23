import { pipe } from 'fp-ts/function'

import { DayJs } from '../../../shared/models/DayJs'
import { Future, toNotUsed } from '../../../shared/utils/fp'

import type { Migration } from '../../models/migration/Migration'
import type { MongoCollectionGetter } from '../../models/mongo/MongoCollection'
import type { PollResponseOutput } from '../../models/poll/PollResponse'

export const Migration202203281837 = (mongoCollection: MongoCollectionGetter): Migration => ({
  createdAt: DayJs.of('2022-03-28T18:37:00Z'),
  migrate: pipe(
    mongoCollection<PollResponseOutput>('pollResponse').future(coll => coll.drop()),
    Future.map(toNotUsed),
  ),
})
