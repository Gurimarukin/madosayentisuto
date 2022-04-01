import { parse as parseCookie } from 'cookie'
import type { RequestHandler } from 'express'
import { json, string, task } from 'fp-ts'
import { flow, identity, pipe } from 'fp-ts/function'
import type { IncomingMessage } from 'http'
import { MediaType } from 'hyper-ts'
import type {
  Connection,
  CookieOptions,
  HeadersOpen,
  ResponseEnded,
  Status,
  StatusOpen,
} from 'hyper-ts'
import * as M from 'hyper-ts/lib/Middleware'
import { toRequestHandler as toRequestHandler_ } from 'hyper-ts/lib/express'
import type { Decoder } from 'io-ts/Decoder'
import * as D from 'io-ts/Decoder'
import type { Encoder } from 'io-ts/lib/Encoder'

import { MsDuration } from '../../../shared/models/MsDuration'
import { StringUtils } from '../../../shared/utils/StringUtils'
import { List, Maybe } from '../../../shared/utils/fp'
import { Try } from '../../../shared/utils/fp'
import { Tuple } from '../../../shared/utils/fp'
import { Future } from '../../../shared/utils/fp'
import { Dict, Either } from '../../../shared/utils/fp'
import { decodeError } from '../../../shared/utils/ioTsUtils'

import { unknownToError } from '../../utils/unknownToError'

export type MyMiddleware<I, O, A> = (c: Connection<I>) => Future<Tuple<A, Connection<O>>>

type DecoderWithName<A> = Tuple<Decoder<unknown, A>, string>

// alias to readonly

const fromEither = M.fromEither as <I = StatusOpen, A = never>(fa: Try<A>) => MyMiddleware<I, I, A>

const map = M.map as <A, B>(
  f: (a: A) => B,
) => <I>(fa: MyMiddleware<I, I, A>) => MyMiddleware<I, I, B>

const ichain = M.ichain as <A, O, Z, B>(
  f: (a: A) => MyMiddleware<O, Z, B>,
) => <I>(ma: MyMiddleware<I, O, A>) => MyMiddleware<I, Z, B>

const orElse = M.orElse as <I, O, A>(
  f: (e: Error) => MyMiddleware<I, O, A>,
) => (ma: MyMiddleware<I, O, A>) => MyMiddleware<I, O, A>

type MyCookieOptions = Omit<CookieOptions, 'maxAge'> & {
  readonly maxAge?: MsDuration
}

const cookie = (
  name: string,
  value: string,
  { maxAge, ...options }: MyCookieOptions,
): MyMiddleware<HeadersOpen, HeadersOpen, void> =>
  M.cookie(name, value, {
    ...options,
    ...(maxAge === undefined ? {} : { maxAge: MsDuration.unwrap(maxAge) }),
  })

// override decoders

const decoderParam = <I = StatusOpen, A = never>(
  name: string,
  decoderWithName: DecoderWithName<A>,
): MyMiddleware<I, I, A> => M.decodeParam(name, tryDecode(decoderWithName))

const decodeParams = <I = StatusOpen, A = never>(
  decoderWithName: DecoderWithName<A>,
): MyMiddleware<I, I, A> => M.decodeParams(tryDecode(decoderWithName))

const decodeQuery = <I = StatusOpen, A = never>(
  decoderWithName: DecoderWithName<A>,
): MyMiddleware<I, I, A> => M.decodeQuery(tryDecode(decoderWithName))

// decode body as json
const decodeBody = <I = StatusOpen, A = never>(
  decoderWithName: DecoderWithName<A>,
): MyMiddleware<I, I, A> =>
  pipe(
    M.decodeHeader<I, Error, void>('Content-Type', contentType =>
      contentType === MediaType.applicationJSON
        ? Either.right(undefined)
        : Either.left(Error(`Expected 'Content-Type' to be '${MediaType.applicationJSON}'`)),
    ),
    ichain(() => getBodyString()),
    ichain(flow(json.parse, Either.mapLeft(unknownToError), e => fromEither(e))),
    ichain(flow(tryDecode(decoderWithName), e => fromEither(e))),
  )

const decodeMethod = <I = StatusOpen, A = never>(
  decoderWithName: DecoderWithName<A>,
): MyMiddleware<I, I, A> => M.decodeMethod(tryDecode(decoderWithName))

const decodeHeader = <I = StatusOpen, A = never>(
  name: string,
  decoderWithName: DecoderWithName<A>,
): MyMiddleware<I, I, A> => M.decodeHeader(name, tryDecode(decoderWithName))

// custom methods

const match =
  <I, A, B>(onLeft: (e: Error) => B, onRight: (a: A) => B) =>
  (ma: MyMiddleware<I, I, A>): MyMiddleware<I, I, B> =>
  conn =>
    pipe(
      ma(conn),
      task.map(
        flow(
          Either.fold(e => Tuple.of(onLeft(e), conn), Tuple.mapFst(onRight)),
          Try.right,
        ),
      ),
    )

const matchE =
  <I, A, O, B>(
    onLeft: (e: Error) => MyMiddleware<I, O, B>,
    onRight: (a: A) => MyMiddleware<I, O, B>,
  ) =>
  (ma: MyMiddleware<I, I, A>): MyMiddleware<I, O, B> =>
    pipe(ma, match(onLeft, onRight), ichain(identity))

const getBodyChunks =
  <I = StatusOpen>(): MyMiddleware<I, I, List<unknown>> =>
  conn =>
    pipe(
      requestChunks(conn.getRequest()),
      Future.map(a => Tuple.of(a, conn)),
    )

const getBodyString = <I = StatusOpen>(): MyMiddleware<I, I, string> =>
  pipe(getBodyChunks<I>(), map(flow(List.map(String), StringUtils.mkString(''))))

const getCookies = <I = StatusOpen>(): MyMiddleware<I, I, Dict<string, string>> =>
  pipe(
    decodeHeader<I, Maybe<string>>('cookie', [Maybe.decoder(D.string), 'Maybe<string>']),
    ichain(
      Maybe.fold(
        () => M.of({}),
        str =>
          pipe(
            Try.tryCatch(() => parseCookie(str)),
            e => fromEither(e),
          ),
      ),
    ),
  )

const sendWithStatus =
  (status: Status, headers: Dict<string, string> = {}) =>
  (message: string): EndedMiddleware =>
    pipe(
      reduceHeaders(status, headers),
      ichain(() => M.closeHeaders()),
      ichain(() => M.send(message)),
    )

const jsonWithStatus =
  <O, A>(status: Status, encoder: Encoder<O, A>, headers: Dict<string, string> = {}) =>
  (data: A): EndedMiddleware =>
    pipe(
      reduceHeaders(status, headers),
      ichain(() => M.json(encoder.encode(data), unknownToError)),
    )

// Express

const toRequestHandler = toRequestHandler_ as <I, O>(
  middleware: MyMiddleware<I, O, void>,
) => RequestHandler

export const MyMiddleware = {
  ...M,
  map,
  ichain,
  orElse,
  cookie,

  decoderParam,
  decodeParams,
  decodeQuery,
  decodeBody,
  decodeMethod,
  decodeHeader,

  getCookies,
  match,
  matchE,
  getBodyString,
  sendWithStatus,
  jsonWithStatus,

  toRequestHandler,
}

export type EndedMiddleware = MyMiddleware<StatusOpen, ResponseEnded, void>

const requestChunks = (req: IncomingMessage): Future<List<unknown>> =>
  Future.tryCatch(
    () =>
      new Promise<List<unknown>>((resolve, reject) => {
        // eslint-disable-next-line functional/prefer-readonly-type
        const body: unknown[] = []
        /* eslint-disable functional/no-expression-statement */
        // eslint-disable-next-line functional/immutable-data
        req.on('data', chunk => body.push(chunk))
        req.on('end', () => resolve(body))
        req.on('error', e => reject(e))
        /* eslint-enable functional/no-expression-statement */
      }),
  )

const tryDecode =
  <A>([decoder, decoderName]: DecoderWithName<A>) =>
  (u: unknown): Try<A> =>
    pipe(decoder.decode(u), Either.mapLeft(decodeError(decoderName)(u)))

const reduceHeaders = (
  status: Status,
  headers: Dict<string, string>,
): MyMiddleware<StatusOpen, HeadersOpen, void> =>
  pipe(
    headers,
    Dict.reduceWithIndex(string.Ord)(M.status(status), (key, acc, val) =>
      pipe(
        acc,
        M.ichain(() => M.header(key, val)),
      ),
    ),
  )
