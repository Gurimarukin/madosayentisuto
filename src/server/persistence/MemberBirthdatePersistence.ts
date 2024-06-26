import { pipe } from 'fp-ts/function'

import type { DayJs } from '../../shared/models/DayJs'
import { DiscordUserId } from '../../shared/models/DiscordUserId'
import type { NotUsed } from '../../shared/utils/fp'
import { Future, List, NonEmptyArray } from '../../shared/utils/fp'

import { FpCollection } from '../helpers/FpCollection'
import type { LoggerGetter } from '../models/logger/LoggerObservable'
import { Birthdate } from '../models/member/Birthdate'
import { MemberBirthdate } from '../models/member/MemberBirthdate'
import type { MongoCollectionGetter } from '../models/mongo/MongoCollection'

export type MemberBirthdatePersistence = ReturnType<typeof MemberBirthdatePersistence>

export const MemberBirthdatePersistence = (
  Logger: LoggerGetter,
  mongoCollection: MongoCollectionGetter,
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
) => {
  const logger = Logger('MemberBirthdatePersistence')
  const collection = FpCollection(logger)([MemberBirthdate.codec, 'MemberBirthdate'])(
    mongoCollection('memberBirthdate'),
  )

  const ensureIndexes: Future<NotUsed> = collection.ensureIndexes([
    { key: { id: -1 }, unique: true },
  ])

  const Keys = {
    month: collection.path(['birthdate', 'month']),
    date: collection.path(['birthdate', 'date']),
  }

  return {
    ensureIndexes,

    listForDate: (d: DayJs): Future<List<MemberBirthdate>> => {
      const { month, date } = Birthdate.fromDate(d)

      return collection.findAllArr()({ [Keys.month]: month, [Keys.date]: date })
    },

    listForMembers: (ids: List<DiscordUserId>): Future<List<MemberBirthdate>> =>
      !List.isNonEmpty(ids)
        ? Future.successful([])
        : collection.findAllArr()({
            id: { $in: NonEmptyArray.encoder(DiscordUserId.codec).encode(ids) },
          }),

    upsert: (state: MemberBirthdate): Future<boolean> =>
      pipe(
        collection.updateOne({ id: DiscordUserId.codec.encode(state.id) }, state, { upsert: true }),
        Future.map(r => r.modifiedCount + r.upsertedCount <= 1),
      ),

    remove: (id: DiscordUserId): Future<boolean> =>
      pipe(
        collection.deleteOne({ id: DiscordUserId.codec.encode(id) }),
        Future.map(r => r.deletedCount === 1),
      ),
  }
}
