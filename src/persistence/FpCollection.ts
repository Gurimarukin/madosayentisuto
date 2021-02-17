import { flow, pipe } from 'fp-ts/function'
import * as C from 'io-ts/Codec'
import * as D from 'io-ts/Decoder'
import {
  ClientSession,
  Collection,
  CollectionInsertManyOptions,
  CollectionInsertOneOptions,
  Cursor,
  FilterQuery,
  FindOneOptions,
  InsertOneWriteOpResult,
  InsertWriteOpResult,
  OptionalId,
  ReplaceOneOptions,
  ReplaceWriteOpResult,
  UpdateOneOptions,
  UpdateWriteOpResult,
  WithId,
} from 'mongodb'

import { IndexSpecification, ReadonlyPartial, WithoutProjection } from '../models/MongoTypings'
import { Logger } from '../services/Logger'
import { Either, Future, Maybe } from '../utils/fp'

export type FpCollection = ReturnType<typeof FpCollection>

export function FpCollection<A, O extends { readonly [key: string]: unknown }>(
  logger: Logger,
  collection: <T>(f: (coll: Collection<O>) => Promise<T>) => Future<T>,
  codec: C.Codec<unknown, OptionalId<O>, A>,
) {
  return {
    collection,

    ensureIndexes: (
      indexSpecs: IndexSpecification<A>[],
      options?: { readonly session?: ClientSession },
    ): Future<void> =>
      pipe(
        Future.fromIOEither(logger.debug('Ensuring indexes')),
        Future.chain(() => collection(c => c.createIndexes(indexSpecs, options))),
      ),

    insertOne: (
      doc: A,
      options?: CollectionInsertOneOptions,
    ): Future<InsertOneWriteOpResult<WithId<O>>> => {
      const encoded = codec.encode(doc)
      return pipe(
        collection(c => c.insertOne(encoded, options)),
        Future.chain(res =>
          pipe(
            Future.fromIOEither(logger.debug('inserted', encoded)),
            Future.map(() => res),
          ),
        ),
      )
    },

    insertMany: (
      docs: A[],
      options?: CollectionInsertManyOptions,
    ): Future<InsertWriteOpResult<WithId<O>>> => {
      const encoded = docs.map(codec.encode)
      return pipe(
        collection(c => c.insertMany(encoded, options)),
        Future.chain(res =>
          pipe(
            Future.fromIOEither(logger.debug(`inserted ${res.insertedCount} documents`)),
            Future.map(() => res),
          ),
        ),
      )
    },

    updateOne: (
      filter: FilterQuery<O>,
      doc: A,
      options?: UpdateOneOptions,
    ): Future<UpdateWriteOpResult> => {
      const encoded = codec.encode(doc)
      return pipe(
        collection(c => c.updateOne(filter, { $set: encoded as ReadonlyPartial<O> }, options)),
        Future.chain(res =>
          pipe(
            Future.fromIOEither(logger.debug('updated', encoded)),
            Future.map(() => res),
          ),
        ),
      )
    },

    replaceOne: (
      filter: FilterQuery<O>,
      doc: A,
      options?: ReplaceOneOptions,
    ): Future<ReplaceWriteOpResult> => {
      const encoded = codec.encode(doc)
      return pipe(
        collection(c => c.replaceOne(filter, encoded as O, options)),
        Future.chain(res =>
          pipe(
            Future.fromIOEither(logger.debug('upserted', encoded)),
            Future.map(() => res),
          ),
        ),
      )
    },

    count: (filter: FilterQuery<O>): Future<number> => collection(c => c.countDocuments(filter)),

    findOne: (
      filter: FilterQuery<O>,
      options?: WithoutProjection<FindOneOptions<O>>,
    ): Future<Maybe<A>> =>
      pipe(
        collection(c => c.findOne(filter, options)),
        Future.map(Maybe.fromNullable),
        Future.chain(
          Maybe.fold(
            () => Future.right(Maybe.none),
            flow(codec.decode, Either.bimap(decodeError, Maybe.some), Future.fromEither),
          ),
        ),
      ),

    find: (
      query: FilterQuery<O>,
      options?: WithoutProjection<FindOneOptions<O>>,
    ): Future<Cursor<Either<Error, A>>> =>
      collection(c =>
        Promise.resolve(
          c.find(query, options).map(flow(codec.decode, Either.mapLeft(decodeError))),
        ),
      ),

    drop: (): Future<void> =>
      pipe(
        collection(c => c.drop()),
        Future.chain(res =>
          pipe(
            Future.fromIOEither(logger.info('droped collection')),
            Future.map(() => res),
          ),
        ),
      ),
  }
}

export function decodeError(e: D.DecodeError): Error {
  return Error(`DecodeError:\n${D.draw(e)}`)
}
