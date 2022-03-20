import { pipe } from 'fp-ts/function'

import { UserId } from '../../shared/models/guild/UserId'
import { Future, List, Tuple } from '../../shared/utils/fp'

import { FpCollection } from '../helpers/FpCollection'
import type { MemberBirthdateOutput } from '../models/MemberBirthdate'
import { MemberBirthdate } from '../models/MemberBirthdate'
import type { MongoCollection } from '../models/MongoCollection'
import type { LoggerGetter } from '../models/logger/LoggerType'

export type MemberBirthdatePersistence = ReturnType<typeof MemberBirthdatePersistence>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const MemberBirthdatePersistence = (
  Logger: LoggerGetter,
  mongoCollection: MongoCollection,
) => {
  const logger = Logger('MemberBirthdatePersistence')
  const decoderWithName = Tuple.of(MemberBirthdate.codec, 'MemberBirthdate')
  const collection = FpCollection<MemberBirthdate, MemberBirthdateOutput>(
    logger,
    mongoCollection('memberBirthdate'),
    decoderWithName,
  )

  const ensureIndexes: Future<void> = collection.ensureIndexes([{ key: { id: -1 }, unique: true }])

  return {
    ensureIndexes,

    listForMembers: (ids: List<UserId>): Future<List<MemberBirthdate>> =>
      pipe(
        collection.findAll(decoderWithName)({ id: { $in: pipe(ids, List.map(UserId.unwrap)) } }),
      ),

    upsert: (state: MemberBirthdate): Future<boolean> =>
      pipe(
        collection.updateOne({ id: UserId.unwrap(state.id) }, state, { upsert: true }),
        Future.map(r => r.modifiedCount + r.upsertedCount <= 1),
      ),

    remove: (id: UserId): Future<boolean> =>
      pipe(
        collection.deleteOne({ id: UserId.unwrap(id) }),
        Future.map(r => r.deletedCount === 1),
      ),
  }
}