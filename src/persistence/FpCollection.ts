import * as t from 'io-ts'
import {
  Collection,
  CollectionInsertOneOptions,
  FilterQuery,
  InsertOneWriteOpResult,
  FindOneOptions,
  ReplaceOneOptions,
  UpdateOneOptions,
  UpdateQuery,
  UpdateWriteOpResult
} from 'mongodb'

import { OptionalId, WithId } from '../models/MongoTypings'
import { Logger } from '../services/Logger'
import { Future, pipe, Maybe, Either } from '../utils/fp'

export type FpCollection = ReturnType<typeof FpCollection>
export const FpCollection = <A, O>(
  logger: Logger,
  collection: () => Future<Collection<O>>,
  codec: t.Type<A, OptionalId<O>>
) => {
  const insertOne = (
    doc: A,
    options?: CollectionInsertOneOptions
  ): Future<InsertOneWriteOpResult<WithId<O>>> => {
    const encoded = codec.encode(doc)
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

  const replaceOne = (filter: FilterQuery<O>, doc: A, options?: ReplaceOneOptions) => {
    const encoded = codec.encode(doc)
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

  const findOne = (filter: FilterQuery<O>, options?: FindOneOptions): Future<Maybe<A>> =>
    pipe(
      collection(),
      Future.chain(_ => Future.apply(() => _.findOne(filter, options))),
      Future.map(Maybe.fromNullable),
      Future.chain(
        Maybe.fold(
          () => Future.right(Maybe.none),
          _ =>
            pipe(
              codec.decode(_),
              Either.bimap(_ => Error("Couldn't decode value"), Maybe.some),
              Future.fromEither
            )
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
