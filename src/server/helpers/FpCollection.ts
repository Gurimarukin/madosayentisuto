import { flow, pipe } from 'fp-ts/function'
import type { Codec } from 'io-ts/Codec'
import type { Decoder } from 'io-ts/Decoder'
import type {
  BulkWriteOptions,
  ClientSession,
  Collection,
  DeleteOptions,
  DeleteResult,
  Document,
  Filter,
  FindOptions,
  InsertManyResult,
  InsertOneOptions,
  InsertOneResult,
  MatchKeysAndValues,
  OptionalUnlessRequiredId,
  ReplaceOptions,
  UpdateOptions,
  UpdateResult,
} from 'mongodb'

import { StringUtils } from '../../shared/utils/StringUtils'
import type { Dict, Tuple } from '../../shared/utils/fp'
import { toUnit } from '../../shared/utils/fp'
import { Either, Future, List, Maybe } from '../../shared/utils/fp'
import { futureMaybe } from '../../shared/utils/futureMaybe'
import { decodeError } from '../../shared/utils/ioTsUtils'

import type { LoggerType } from '../models/logger/LoggerType'
import type { IndexDescription, WithoutProjection } from '../models/mongo/MongoTypings'

export type FpCollection = ReturnType<typeof FpCollection>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const FpCollection = <A, O extends Dict<string, unknown>>(
  logger: LoggerType,
  collection: <T>(f: (coll: Collection<O>) => Promise<T>) => Future<T>,
  codecWithName: Tuple<Codec<unknown, OptionalUnlessRequiredId<O>, A>, string>,
) => {
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
          collection(c =>
            // eslint-disable-next-line functional/prefer-readonly-type
            c.createIndexes(indexSpecs as IndexDescription<A>[], options),
          ),
        ),
        Future.map(toUnit),
      ),

    insertOne: (doc: A, options: InsertOneOptions = {}): Future<InsertOneResult<O>> => {
      const encoded = codec.encode(doc)
      return pipe(
        collection(c => c.insertOne(encoded, options)),
        Future.chainFirstIOEitherK(() => logger.debug('Inserted', JSON.stringify(encoded))),
      )
    },

    insertMany: (docs: List<A>, options: BulkWriteOptions = {}): Future<InsertManyResult<O>> => {
      const encoded = docs.map(codec.encode)
      return pipe(
        collection(c => c.insertMany(encoded, options)),
        Future.chainFirstIOEitherK(res => logger.debug(`Inserted ${res.insertedCount} documents`)),
      )
    },

    updateOne: (filter: Filter<O>, doc: A, options: UpdateOptions = {}): Future<UpdateResult> => {
      const encoded = codec.encode(doc)
      return pipe(
        collection(c => c.updateOne(filter, { $set: encoded as MatchKeysAndValues<O> }, options)),
        Future.chainFirstIOEitherK(() => logger.debug('Updated', JSON.stringify(encoded))),
      )
    },

    replaceOne: (
      filter: Filter<O>,
      doc: A,
      options: ReplaceOptions = {},
    ): Future<UpdateResult | Document> => {
      const encoded = codec.encode(doc)
      return pipe(
        collection(c => c.replaceOne(filter, encoded as O, options)),
        Future.chainFirstIOEitherK(() => logger.debug('Replaced', JSON.stringify(encoded))),
      )
    },

    count: (filter: Filter<O>): Future<number> => collection(c => c.countDocuments(filter)),

    findOne: (
      filter: Filter<O>,
      options: WithoutProjection<FindOptions<O>> = {},
    ): Future<Maybe<A>> =>
      pipe(
        collection(c => c.findOne(filter, options)),
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
        collection(c => c.deleteOne(filter, options)),
        Future.chainFirstIOEitherK(res => logger.debug(`Deleted ${res.deletedCount} documents`)),
      ),

    deleteMany: (filter: Filter<O>, options: DeleteOptions = {}): Future<DeleteResult> =>
      pipe(
        collection(c => c.deleteMany(filter, options)),
        Future.chainFirstIOEitherK(res => logger.debug(`Deleted ${res.deletedCount} documents`)),
      ),

    drop: (): Future<boolean> =>
      pipe(
        collection(c => c.drop()),
        Future.chainFirstIOEitherK(() => logger.debug('Dropped collection')),
      ),
  }

  function findAll(): (query: Filter<O>, options?: FindOptions<O>) => Future<List<A>>
  function findAll<B>([decoder, decoderName]: Tuple<Decoder<unknown, B>, string>): (
    query: Filter<O>,
    options?: FindOptions<O>,
  ) => Future<List<B>>
  function findAll<B>(
    [decoder, decoderName] = codecWithName as Tuple<Decoder<unknown, B>, string>,
  ): (query: Filter<O>, options?: FindOptions<O>) => Future<List<B>> {
    return (query, options) =>
      pipe(
        collection(coll => coll.find(query, options).toArray()),
        Future.chainFirstIOEitherK(res => logger.debug('Found all', JSON.stringify(res))),
        Future.chain(
          Future.traverseSeqArray(u =>
            pipe(
              decoder.decode(u),
              Either.fold(
                flow(
                  decodeError(decoderName)(u),
                  e => logger.warn(e.stack),
                  Future.fromIOEither,
                  Future.map(() => Maybe.none),
                ),
                flow(Maybe.some, Future.right),
              ),
            ),
          ),
        ),
        Future.map(List.compact),
      )
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

export const FpCollectionHelpers = {
  getPath: <A>(): Path<A> => StringUtils.mkString('.'),
}
