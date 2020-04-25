import * as t from 'io-ts'
import {
  Collection,
  CollectionInsertOneOptions,
  FilterQuery,
  InsertOneWriteOpResult,
  FindOneOptions,
  ObjectId,
  ReplaceOneOptions,
  UpdateOneOptions,
  UpdateQuery,
  UpdateWriteOpResult
} from 'mongodb'

import { OptionalId, WithId } from '../models/MongoTypings'
import { Logger } from '../services/Logger'
import { Future, pipe, Maybe, Either } from '../utils/fp'

export type FpCollection = ReturnType<typeof FpCollection>
export const FpCollection = <A, O extends {}>(
  logger: Logger,
  collection: () => Future<Collection<O>>,
  codec: t.Type<A, OptionalId<O>>
) => {
  const insertOne = (
    doc: A & { _id?: ObjectId },
    options?: CollectionInsertOneOptions
  ): Future<InsertOneWriteOpResult<WithId<O>>> => {
    const encoded = { _id: doc._id, ...codec.encode(doc as A) }
    return pipe(
      collection(),
      Future.chain(_ => Future.apply(() => _.insertOne(encoded, options))),
      Future.chain(res =>
        pipe(
          Future.fromIOEither(logger.debug('inserted', encoded)),
          Future.map(_ => res)
        )
      )
    )
  }

  const updateOne = (
    filter: FilterQuery<O>,
    update: UpdateQuery<O> | Partial<O>,
    options?: UpdateOneOptions
  ): Future<UpdateWriteOpResult> =>
    pipe(
      collection(),
      Future.chain(_ => Future.apply(() => _.updateOne(filter, update, options))),
      Future.chain(res =>
        pipe(
          Future.fromIOEither(logger.debug('updated', update)),
          Future.map(_ => res)
        )
      )
    )

  const replaceOne = (
    filter: FilterQuery<O>,
    doc: A & { _id?: ObjectId },
    options?: ReplaceOneOptions
  ) => {
    const encoded = codec.encode(doc as A)
    return pipe(
      collection(),
      Future.chain(_ => Future.apply(() => _.replaceOne(filter, encoded as O, options))),
      Future.chain(res =>
        pipe(
          Future.fromIOEither(logger.debug('upserted', encoded)),
          Future.map(_ => res)
        )
      )
    )
  }

  const count = (filter: FilterQuery<O>): Future<number> =>
    pipe(
      collection(),
      Future.chain(_ => Future.apply(() => _.countDocuments(filter)))
    )

  const findOne = (
    filter: FilterQuery<O>,
    options?: FindOneOptions
  ): Future<Maybe<A & { _id: ObjectId }>> =>
    pipe(
      collection(),
      Future.chain(_ => Future.apply(() => _.findOne(filter, options))),
      Future.map(Maybe.fromNullable),
      Future.chain(
        Maybe.fold(
          () => Future.right(Maybe.none),
          raw =>
            pipe(
              codec.decode(raw),
              Either.bimap(
                _ => Error("Couldn't decode value"),
                _ => Maybe.some({ ..._, _id: (raw as any)._id })
              ),
              Future.fromEither
            )
        )
      ),
      Future.chain(res =>
        pipe(
          Future.fromIOEither(logger.debug('found', res)),
          Future.map(_ => res)
        )
      )
    )

  const drop = (): Future<void> =>
    pipe(
      collection(),
      Future.chain(_ => Future.apply(() => _.drop())),
      Future.chain(res =>
        pipe(
          Future.fromIOEither(logger.info('droped collection')),
          Future.map(_ => res)
        )
      )
    )

  return { insertOne, updateOne, replaceOne, count, findOne, drop }
}
