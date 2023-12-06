import { pipe } from 'fp-ts/function'

import { DayJs } from '../../../shared/models/DayJs'
import { Future, toNotUsed } from '../../../shared/utils/fp'

import type { Migration } from '../../models/migration/Migration'
import type { MongoCollectionGetter } from '../../models/mongo/MongoCollection'
import type { TheQuestProgressionDbOutput } from '../../models/theQuest/TheQuestProgressionDb'

export const Migration202312062219 = (mongoCollection: MongoCollectionGetter): Migration => ({
  createdAt: DayJs.of('2023-12-06T22:19:00Z'),
  migrate: pipe(
    mongoCollection<TheQuestProgressionDbOutput>('theQuestProgression').future(coll =>
      coll.updateMany({}, [
        { $set: { 'summoner.riotId': { $concat: ['$summoner.name', '#', '$summoner.platform'] } } },
      ]),
    ),
    Future.map(toNotUsed),
  ),
})
