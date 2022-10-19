import { pipe } from 'fp-ts/function'

import { DayJs } from '../../../shared/models/DayJs'
import { Future, toNotUsed } from '../../../shared/utils/fp'

import type { Migration } from '../../models/migration/Migration'
import type { MongoCollectionGetter } from '../../models/mongo/MongoCollection'
import type { PollQuestionOutput } from '../../models/poll/PollQuestion'

export const Migration202204011827 = (mongoCollection: MongoCollectionGetter): Migration => ({
  createdAt: DayJs.of('2022-04-01T18:27:00Z'),
  migrate: pipe(
    mongoCollection<PollQuestionOutput>('pollQuestion').future(coll =>
      coll.updateMany({}, { $set: { isAnonymous: true } }),
    ),
    Future.map(toNotUsed),
  ),
})
