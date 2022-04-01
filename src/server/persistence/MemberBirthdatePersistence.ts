import { pipe } from 'fp-ts/function'

import type { DayJs } from '../../shared/models/DayJs'
import { DiscordUserId } from '../../shared/models/DiscordUserId'
import { Future, List } from '../../shared/utils/fp'

import { FpCollection } from '../helpers/FpCollection'
import type { LoggerGetter } from '../models/logger/LoggerGetter'
import { Birthdate } from '../models/member/Birthdate'
import type { MemberBirthdateOutput } from '../models/member/MemberBirthdate'
import { MemberBirthdate } from '../models/member/MemberBirthdate'
import type { MongoCollection } from '../models/mongo/MongoCollection'

export type MemberBirthdatePersistence = ReturnType<typeof MemberBirthdatePersistence>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const MemberBirthdatePersistence = (
  Logger: LoggerGetter,
  mongoCollection: MongoCollection,
) => {
  const logger = Logger('MemberBirthdatePersistence')
  const collection = FpCollection<MemberBirthdate, MemberBirthdateOutput>(
    logger,
    mongoCollection('memberBirthdate'),
    [MemberBirthdate.codec, 'MemberBirthdate'],
  )

  const ensureIndexes: Future<void> = collection.ensureIndexes([{ key: { id: -1 }, unique: true }])

  const Keys = {
    month: collection.path(['birthdate', 'month']),
    date: collection.path(['birthdate', 'date']),
  }

  return {
    ensureIndexes,

    listForDate: (d: DayJs): Future<List<MemberBirthdate>> => {
      const { month, date } = Birthdate.fromDate(d)
      return collection.findAll()({ [Keys.month]: month, [Keys.date]: date })
    },

    listForMembers: (ids: List<DiscordUserId>): Future<List<MemberBirthdate>> =>
      collection.findAll()({ id: { $in: pipe(ids, List.map(DiscordUserId.unwrap)) } }),

    upsert: (state: MemberBirthdate): Future<boolean> =>
      pipe(
        collection.updateOne({ id: DiscordUserId.unwrap(state.id) }, state, { upsert: true }),
        Future.map(r => r.modifiedCount + r.upsertedCount <= 1),
      ),

    remove: (id: DiscordUserId): Future<boolean> =>
      pipe(
        collection.deleteOne({ id: DiscordUserId.unwrap(id) }),
        Future.map(r => r.deletedCount === 1),
      ),
  }
}
