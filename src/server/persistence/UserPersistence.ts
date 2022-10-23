import { pipe } from 'fp-ts/function'

import { UserName } from '../../shared/models/webUser/UserName'
import type { Maybe, NotUsed } from '../../shared/utils/fp'
import { Future } from '../../shared/utils/fp'

import { FpCollection } from '../helpers/FpCollection'
import type { LoggerGetter } from '../models/logger/LoggerObservable'
import type { MongoCollectionGetter } from '../models/mongo/MongoCollection'
import { WebUser } from '../models/webUser/WebUser'

export type UserPersistence = ReturnType<typeof UserPersistence>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function UserPersistence(Logger: LoggerGetter, mongoCollection: MongoCollectionGetter) {
  const logger = Logger('UserPersistence')
  const collection = FpCollection(logger)([WebUser.codec, 'WebUser'])(mongoCollection('user'))

  const ensureIndexes: Future<NotUsed> = collection.ensureIndexes([
    { key: { id: -1 }, unique: true },
    { key: { userName: -1 }, unique: true },
  ])

  return {
    ensureIndexes,

    findByUserName: (userName: UserName): Future<Maybe<WebUser>> =>
      collection.findOne({ userName: UserName.codec.encode(userName) }),

    create: (user: WebUser): Future<boolean> =>
      pipe(
        collection.insertOne(user),
        Future.map(r => r.acknowledged),
      ),
  }
}
