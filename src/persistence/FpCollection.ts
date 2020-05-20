import * as t from 'io-ts'
import util from 'util'
import {
  ClientSession,
  Collection,
  CollectionInsertOneOptions,
  Cursor,
  FilterQuery,
  InsertOneWriteOpResult,
  FindOneOptions,
  ReplaceOneOptions,
  ReplaceWriteOpResult,
  UpdateOneOptions,
  UpdateWriteOpResult
} from 'mongodb'

import { OptionalId, WithId, IndexSpecification } from '../models/MongoTypings'
import { Logger } from '../services/Logger'
import { Future, pipe, Maybe, Either } from '../utils/fp'

export const FpCollection = <A, O>(
  logger: Logger,
  collection: () => Future<Collection<O>>,
  codec: t.Type<A, OptionalId<O>>
) => ({
  ensureIndexes: (
    indexSpecs: IndexSpecification<A>[],
    options?: { session?: ClientSession }
  ): Future<void> =>
    pipe(
      Future.fromIOEither(logger.debug('Ensuring indexes')),
      Future.chain(_ => collection()),
      Future.chain(_ => Future.apply(() => _.createIndexes(indexSpecs, options)))
    ),

  insertOne: (
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
  },

  updateOne: (
    filter: FilterQuery<O>,
    doc: A,
    options?: UpdateOneOptions
  ): Future<UpdateWriteOpResult> => {
    const encoded = codec.encode(doc)
    return pipe(
      collection(),
      Future.chain(_ => Future.apply(() => _.updateOne(filter, { $set: encoded }, options))),
      Future.chain(res =>
        pipe(
          Future.fromIOEither(logger.debug('updated', encoded)),
          Future.map(_ => res)
        )
      )
    )
  },

  replaceOne: (
    filter: FilterQuery<O>,
    doc: A,
    options?: ReplaceOneOptions
  ): Future<ReplaceWriteOpResult> => {
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
  },

  count: (filter: FilterQuery<O>): Future<number> =>
    pipe(
      collection(),
      Future.chain(_ => Future.apply(() => _.countDocuments(filter)))
    ),

  findOne: (filter: FilterQuery<O>, options?: FindOneOptions): Future<Maybe<A>> =>
    pipe(
      collection(),
      Future.chain(_ => Future.apply(() => _.findOne(filter, options))),
      Future.map(Maybe.fromNullable),
      Future.chain(
        Maybe.fold(
          () => Future.right(Maybe.none),
          u =>
            pipe(
              codec.decode(u),
              Either.bimap(_ => decodeError(codec, u), Maybe.some),
              Future.fromEither
            )
        )
      )
    ),

  find: (query: FilterQuery<O>, options?: FindOneOptions): Future<Cursor<Either<Error, A>>> =>
    pipe(
      collection(),
      Future.map(_ =>
        _.find(query, options).map(u =>
          pipe(
            codec.decode(u),
            Either.mapLeft(_ => decodeError(codec, u))
          )
        )
      )
    ),

  drop: (): Future<void> =>
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
})

export type FpCollection = ReturnType<typeof FpCollection>

function decodeError<A, B>(codec: t.Type<A, B>, u: unknown): Error {
  return Error(`Couldn't decode value as ${codec.name}:\n${util.format(u)}`)
}
