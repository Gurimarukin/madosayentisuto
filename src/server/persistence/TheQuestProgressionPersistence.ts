import { pipe } from 'fp-ts/function'
import type { AnyBulkWriteOperation } from 'mongodb'

import { DiscordUserId } from '../../shared/models/DiscordUserId'
import type { NotUsed } from '../../shared/utils/fp'
import { Future, List, NonEmptyArray } from '../../shared/utils/fp'

import { FpCollection } from '../helpers/FpCollection'
import type { LoggerGetter } from '../models/logger/LoggerObservable'
import type { MongoCollectionGetter } from '../models/mongo/MongoCollection'
import type { TheQuestProgressionDbOutput } from '../models/theQuest/TheQuestProgressionDb'
import { TheQuestProgressionDb } from '../models/theQuest/TheQuestProgressionDb'

type TheQuestProgressionPersistence = ReturnType<typeof TheQuestProgressionPersistence>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function TheQuestProgressionPersistence(
  Logger: LoggerGetter,
  mongoCollection: MongoCollectionGetter,
) {
  const logger = Logger('TheQuestProgressionPersistence')
  const collection = FpCollection(logger)([TheQuestProgressionDb.codec, 'TheQuestProgressionDb'])(
    mongoCollection('theQuestProgression'),
  )

  const ensureIndexes: Future<NotUsed> = collection.ensureIndexes([{ key: { userId: -1 } }])

  return {
    ensureIndexes,

    listAllForIds: (ids: List<DiscordUserId>): Future<List<TheQuestProgressionDb>> =>
      !List.isNonEmpty(ids)
        ? Future.successful([])
        : collection.findAllArr()({
            userId: { $in: NonEmptyArray.encoder(DiscordUserId.codec).encode(ids) },
          }),

    bulkUpsert: (progressions: List<TheQuestProgressionDb>): Future<boolean> => {
      const operations: List<AnyBulkWriteOperation<TheQuestProgressionDbOutput>> = pipe(
        progressions,
        List.map((p): AnyBulkWriteOperation<TheQuestProgressionDbOutput> => {
          const { userId: encodedUserId, ...$set } = TheQuestProgressionDb.codec.encode(p)
          return {
            updateOne: {
              filter: {
                userId: encodedUserId,
              },
              update: { $set },
              upsert: true,
            },
          }
        }),
      )
      return !List.isNonEmpty(operations)
        ? Future.successful(true)
        : pipe(
            collection.collection.future(c =>
              c.bulkWrite(List.asMutable(operations), { ordered: false }),
            ),
            Future.map(r => r.modifiedCount + r.upsertedCount <= progressions.length),
          )
    },

    removeForIds: (ids: List<DiscordUserId>): Future<number> =>
      !List.isNonEmpty(ids)
        ? Future.successful(0)
        : pipe(
            collection.deleteMany({
              userId: { $in: NonEmptyArray.encoder(DiscordUserId.codec).encode(ids) },
            }),
            Future.map(r => r.deletedCount),
          ),
  }
}

export { TheQuestProgressionPersistence }
