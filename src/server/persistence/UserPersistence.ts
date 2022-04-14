import { pipe } from 'fp-ts/function'

import { UserName } from '../../shared/models/webUser/UserName'
import type { Maybe } from '../../shared/utils/fp'
import { Future } from '../../shared/utils/fp'

import { FpCollection } from '../helpers/FpCollection'
import type { LoggerGetter } from '../models/logger/LoggerGetter'
import type { MongoCollection } from '../models/mongo/MongoCollection'
import type { WebUserOutput } from '../models/webUser/WebUser'
import { WebUser } from '../models/webUser/WebUser'

export type UserPersistence = ReturnType<typeof UserPersistence>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function UserPersistence(
  Logger: LoggerGetter,
  mongoCollection: (collName: string) => MongoCollection,
) {
  const logger = Logger('UserPersistence')
  const collection = FpCollection<WebUser, WebUserOutput>(logger, mongoCollection('user'), [
    WebUser.codec,
    'WebUser',
  ])

  const ensureIndexes: Future<void> = collection.ensureIndexes([
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
