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
  OptionalId,
  ReplaceOptions,
  UpdateOptions,
  UpdateResult,
} from 'mongodb'

import { futureMaybe } from '../../shared/utils/FutureMaybe'
import type { Tuple } from '../../shared/utils/fp'
import { Either, Future, List, Maybe } from '../../shared/utils/fp'
import { decodeError } from '../../shared/utils/ioTsUtils'

import type { IndexDescription, WithoutProjection } from '../models/MongoTypings'
import type { LoggerType } from '../models/logger/LoggerType'

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
      logger.info('Ensuring indexes'),
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
      Future.chainFirstIOEitherK(() => logger.debug('inserted', encoded)),
    )
  },

  insertMany: (docs: List<A>, options: BulkWriteOptions = {}): Future<InsertManyResult<O>> => {
    const encoded = docs.map(codec.encode)
    return pipe(
      collection(c => c.insertMany(encoded, options)),
      Future.chainFirstIOEitherK(res => logger.debug(`inserted ${res.insertedCount} documents`)),
    )
  },

  updateOne: (filter: Filter<O>, doc: A, options: UpdateOptions = {}): Future<UpdateResult> => {
    const encoded = codec.encode(doc)
    return pipe(
      collection(c => c.updateOne(filter, { $set: encoded as MatchKeysAndValues<O> }, options)),
      Future.chainFirstIOEitherK(() => logger.debug('updated', encoded)),
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
      Future.chainFirstIOEitherK(() => logger.debug('replaced', encoded)),
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
      ),

  deleteOne: (filter: Filter<O>, options: DeleteOptions = {}): Future<DeleteResult> =>
    pipe(
      collection(c => c.deleteOne(filter, options)),
      Future.chainFirstIOEitherK(res => logger.debug(`deleted ${res.deletedCount} documents`)),
    ),

  deleteMany: (filter: Filter<O>, options: DeleteOptions = {}): Future<DeleteResult> =>
    pipe(
      collection(c => c.deleteMany(filter, options)),
      Future.chainFirstIOEitherK(res => logger.debug(`deleted ${res.deletedCount} documents`)),
    ),

  drop: (): Future<boolean> =>
    pipe(
      collection(c => c.drop()),
      Future.chainFirstIOEitherK(() => logger.debug('dropped collection')),
    ),
})
