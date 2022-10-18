import { identity, pipe } from 'fp-ts/function'
import type { Codec } from 'io-ts/Codec'
import type { Decoder } from 'io-ts/Decoder'
import type {
  BulkWriteOptions,
  ClientSession,
  DeleteOptions,
  DeleteResult,
  Filter,
  FindOptions,
  InsertManyResult,
  InsertOneOptions,
  InsertOneResult,
  MatchKeysAndValues,
  Document as MongoDocument,
  IndexDescription as MongoIndexDescription,
  OptionalUnlessRequiredId,
  ReplaceOptions,
  UpdateOptions,
  UpdateResult,
} from 'mongodb'

import type { LoggerType } from '../../shared/models/LoggerType'
import { TObservable } from '../../shared/models/rx/TObservable'
import type { Dict, Tuple } from '../../shared/utils/fp'
import { List } from '../../shared/utils/fp'
import { IO } from '../../shared/utils/fp'
import { toUnit } from '../../shared/utils/fp'
import { Either, Future, Maybe } from '../../shared/utils/fp'
import { futureMaybe } from '../../shared/utils/futureMaybe'
import { decodeError } from '../../shared/utils/ioTsUtils'

import { Store } from '../models/Store'
import type { MongoCollection } from '../models/mongo/MongoCollection'
import type { IndexDescription, WithoutProjection } from '../models/mongo/MongoTypings'

export type FpCollection = ReturnType<ReturnType<ReturnType<typeof FpCollection>>>

export const FpCollection =
  (logger: LoggerType) =>
  <A, O extends Dict<string, unknown>>(
    codecWithName: Tuple<Codec<unknown, OptionalUnlessRequiredId<O>, A>, string>,
  ) =>
  (collection: MongoCollection<O>) => {
    const [codec, codecName] = codecWithName

    return {
      collection,

      path: FpCollectionHelpers.getPath<O>(),

      ensureIndexes: (
        indexSpecs: List<IndexDescription<A>>,
        options: { readonly session?: ClientSession } = {},
      ): Future<void> =>
        pipe(
          logger.info('Ensuring indexes'),
          Future.fromIOEither,
          Future.chain(() =>
            collection.future(c =>
              c.createIndexes(List.toMutable(indexSpecs as List<MongoIndexDescription>), options),
            ),
          ),
          Future.map(toUnit),
        ),

      insertOne: (doc: A, options: InsertOneOptions = {}): Future<InsertOneResult<O>> => {
        const encoded = codec.encode(doc)
        return pipe(
          collection.future(c => c.insertOne(encoded, options)),
          Future.chainFirstIOEitherK(() => logger.debug('Inserted', JSON.stringify(encoded))),
        )
      },

      insertMany: (docs: List<A>, options: BulkWriteOptions = {}): Future<InsertManyResult<O>> => {
        const encoded = docs.map(codec.encode)
        return pipe(
          collection.future(c => c.insertMany(encoded, options)),
          Future.chainFirstIOEitherK(res =>
            logger.debug(`Inserted ${res.insertedCount} documents`),
          ),
        )
      },

      updateOne: (filter: Filter<O>, doc: A, options: UpdateOptions = {}): Future<UpdateResult> => {
        const encoded = codec.encode(doc)
        return pipe(
          collection.future(c =>
            c.updateOne(filter, { $set: encoded as MatchKeysAndValues<O> }, options),
          ),
          Future.chainFirstIOEitherK(() => logger.debug('Updated', JSON.stringify(encoded))),
        )
      },

      replaceOne: (
        filter: Filter<O>,
        doc: A,
        options: ReplaceOptions = {},
      ): Future<UpdateResult | MongoDocument> => {
        const encoded = codec.encode(doc)
        return pipe(
          collection.future(c => c.replaceOne(filter, encoded as O, options)),
          Future.chainFirstIOEitherK(() => logger.debug('Replaced', JSON.stringify(encoded))),
        )
      },

      count: (filter: Filter<O>): Future<number> =>
        collection.future(c => c.countDocuments(filter)),

      findOne: (
        filter: Filter<O>,
        options: WithoutProjection<FindOptions<O>> = {},
      ): Future<Maybe<A>> =>
        pipe(
          collection.future(c => c.findOne(filter, options)),
          Future.chainFirstIOEitherK(res => logger.debug('Found one', JSON.stringify(res))),
          Future.map(Maybe.fromNullable),
          futureMaybe.chain(u =>
            pipe(
              codec.decode(u),
              Either.bimap(decodeError(codecName)(u), Maybe.some),
              Future.fromEither,
            ),
          ),
        ),

      findAll,

      deleteOne: (filter: Filter<O>, options: DeleteOptions = {}): Future<DeleteResult> =>
        pipe(
          collection.future(c => c.deleteOne(filter, options)),
          Future.chainFirstIOEitherK(res => logger.debug(`Deleted ${res.deletedCount} documents`)),
        ),

      deleteMany: (filter: Filter<O>, options: DeleteOptions = {}): Future<DeleteResult> =>
        pipe(
          collection.future(c => c.deleteMany(filter, options)),
          Future.chainFirstIOEitherK(res => logger.debug(`Deleted ${res.deletedCount} documents`)),
        ),

      drop: (): Future<boolean> =>
        pipe(
          collection.future(c => c.drop()),
          Future.chainFirstIOEitherK(() => logger.debug('Dropped collection')),
        ),
    }

    function findAll(): (query: Filter<O>, options?: FindOptions<O>) => TObservable<A>
    function findAll<B>([decoder, decoderName]: Tuple<Decoder<unknown, B>, string>): (
      query: Filter<O>,
      options?: FindOptions<O>,
    ) => TObservable<B>
    function findAll<B>(
      [decoder, decoderName] = codecWithName as Tuple<Decoder<unknown, B>, string>,
    ): (query: Filter<O>, options?: FindOptions<O>) => TObservable<B> {
      return fpCollectionHelpersFindAll(logger, collection, [decoder, decoderName])
    }
  }

type Path<S> = {
  <
    K1 extends keyof S,
    K2 extends keyof S[K1],
    K3 extends keyof S[K1][K2],
    K4 extends keyof S[K1][K2][K3],
    K5 extends keyof S[K1][K2][K3][K4],
  >(
    path: readonly [K1, K2, K3, K4, K5],
  ): string
  <
    K1 extends keyof S,
    K2 extends keyof S[K1],
    K3 extends keyof S[K1][K2],
    K4 extends keyof S[K1][K2][K3],
  >(
    path: readonly [K1, K2, K3, K4],
  ): string
  <K1 extends keyof S, K2 extends keyof S[K1], K3 extends keyof S[K1][K2]>(
    path: readonly [K1, K2, K3],
  ): string
  <K1 extends keyof S, K2 extends keyof S[K1]>(path: readonly [K1, K2]): string
  <K1 extends keyof S>(path: readonly [K1]): string
}

const getPath = <A>(): Path<A> => List.mkString('.')

const fpCollectionHelpersFindAll =
  <O, B>(
    logger: LoggerType,
    collection: MongoCollection<O>,
    [decoder, decoderName]: Tuple<Decoder<unknown, B>, string>,
  ) =>
  (query: Filter<O>, options?: FindOptions<O>): TObservable<B> => {
    const count = Store<number>(0)
    return pipe(
      collection.observable(coll => coll.find(query, options).stream()),
      TObservable.map(u => pipe(decoder.decode(u), Either.mapLeft(decodeError(decoderName)(u)))),
      TObservable.flattenTry,
      TObservable.chainFirstIOK(() => count.modify(n => n + 1)),
      TObservable.map(Maybe.some),
      TObservable.concat(
        pipe(
          futureMaybe.none,
          Future.chainFirstIOEitherK(() =>
            pipe(
              count.get,
              IO.fromIO,
              IO.chain(n => logger.debug(`Found all ${n} documents`)),
            ),
          ),
          TObservable.fromTaskEither,
        ),
      ),
      TObservable.filterMap(identity),
    )
  }

export const FpCollectionHelpers = { getPath, findAll: fpCollectionHelpersFindAll }
