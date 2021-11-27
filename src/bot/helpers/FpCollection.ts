import { flow, pipe } from 'fp-ts/function'
import type { Codec } from 'io-ts/Codec'
import type { Decoder } from 'io-ts/Decoder'
import type {
  BulkWriteOptions,
  ClientSession,
  Collection,
  Document,
  Filter,
  FindOptions,
  InsertManyResult,
  InsertOneOptions,
  InsertOneResult,
  MatchKeysAndValues,
  OptionalId,
  ReplaceOptions,
  UpdateOptions,
  UpdateResult,
} from 'mongodb'

import { futureMaybe } from '../../shared/utils/FutureMaybe'
import type { Tuple } from '../../shared/utils/fp'
import { Either, Future, List, Maybe } from '../../shared/utils/fp'

import type { IndexDescription, WithoutProjection } from '../models/MongoTypings'
import type { LoggerType } from '../models/logger/LoggerType'
import { decodeError } from '../utils/decodeError'

export type FpCollection = ReturnType<typeof FpCollection>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const FpCollection = <A, O extends { readonly [key: string]: unknown }>(
  logger: LoggerType,
  collection: <T>(f: (coll: Collection<O>) => Promise<T>) => Future<T>,
  [codec, codecName]: Tuple<Codec<unknown, OptionalId<O>, A>, string>,
) => ({
  collection,

  ensureIndexes: (
    indexSpecs: List<IndexDescription<A>>,
    options: { readonly session?: ClientSession } = {},
  ): Future<void> =>
    pipe(
      logger.debug('Ensuring indexes'),
      Future.fromIOEither,
      Future.chain(() =>
        collection(c =>
          // eslint-disable-next-line functional/prefer-readonly-type
          c.createIndexes(indexSpecs as unknown as IndexDescription<A>[], options),
        ),
      ),
      Future.map(() => {}),
    ),

  insertOne: (doc: A, options: InsertOneOptions = {}): Future<InsertOneResult<O>> => {
    const encoded = codec.encode(doc)
    return pipe(
      collection(c => c.insertOne(encoded, options)),
      Future.chainFirst(() => Future.fromIOEither(logger.debug('inserted', encoded))),
    )
  },

  insertMany: (docs: List<A>, options: BulkWriteOptions = {}): Future<InsertManyResult<O>> => {
    const encoded = docs.map(codec.encode)
    return pipe(
      collection(c => c.insertMany(encoded, options)),
      Future.chainFirst(res =>
        Future.fromIOEither(logger.debug(`inserted ${res.insertedCount} documents`)),
      ),
    )
  },

  updateOne: (filter: Filter<O>, doc: A, options: UpdateOptions = {}): Future<UpdateResult> => {
    const encoded = codec.encode(doc)
    return pipe(
      collection(c => c.updateOne(filter, { $set: encoded as MatchKeysAndValues<O> }, options)),
      Future.chainFirst(() => Future.fromIOEither(logger.debug('updated', encoded))),
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
      Future.chainFirst(() => Future.fromIOEither(logger.debug('upserted', encoded))),
    )
  },

  count: (filter: Filter<O>): Future<number> => collection(c => c.countDocuments(filter)),

  findOne: (filter: Filter<O>, options: WithoutProjection<FindOptions<O>> = {}): Future<Maybe<A>> =>
    pipe(
      collection(c => c.findOne(filter, options)),
      Future.map(Maybe.fromNullable),
      futureMaybe.chain(u =>
        pipe(
          codec.decode(u),
          Either.bimap(decodeError(codecName)(u), Maybe.some),
          Future.fromEither,
        ),
      ),
    ),

  // find: (
  //   query: Filter<O>,
  //   options?: WithoutProjection<FindOptions<O>>,
  // ): Future<FindCursor<Either<Error, A>>> =>
  //   collection(c =>
  //     Promise.resolve(
  //       c
  //         .find(query, options)
  //         .map(u => pipe(codec.decode(u), Either.mapLeft(decodeError(codecName)(u)))),
  //     ),
  //   ),

  findAll:
    <B>([decoder, decoderName]: Tuple<Decoder<O, B>, string>) =>
    (query: Filter<O>, options?: FindOptions<O>): Future<List<B>> =>
      pipe(
        collection(coll => coll.find(query, options).toArray()),
        Future.chain(
          Future.traverseSeqArray(u =>
            pipe(
              decoder.decode(u),
              Either.fold(
                flow(
                  decodeError(decoderName)(u),
                  e => logger.warn(e.message),
                  Future.fromIOEither,
                  Future.map(() => Maybe.none),
                ),
                flow(Maybe.some, Future.right),
              ),
            ),
          ),
        ),
        Future.map(List.compact),
      ),

  drop: (): Future<boolean> =>
    pipe(
      collection(c => c.drop()),
      Future.chainFirst(() => Future.fromIOEither(logger.info('dropped collection'))),
    ),
})
