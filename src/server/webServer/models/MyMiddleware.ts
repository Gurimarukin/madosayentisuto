import { parse as parseCookie } from 'cookie'
import type * as express from 'express'
import { eitherT, json, string, task } from 'fp-ts'
import type { Apply2 } from 'fp-ts/Apply'
import type { FromIO2 } from 'fp-ts/FromIO'
import type { Functor2 } from 'fp-ts/Functor'
import type { Monad2 } from 'fp-ts/Monad'
import { flow, identity, pipe } from 'fp-ts/function'
import type * as http from 'http'
import type { Connection, CookieOptions, HeadersOpen, ResponseEnded, StatusOpen } from 'hyper-ts'
import { MediaType, Status } from 'hyper-ts'
import * as M from 'hyper-ts/lib/Middleware'
import { toRequestHandler as toRequestHandler_ } from 'hyper-ts/lib/express'
import type { Decoder } from 'io-ts/Decoder'
import * as D from 'io-ts/Decoder'
import type { Encoder } from 'io-ts/Encoder'

import { MsDuration } from '../../../shared/models/MsDuration'
import { Dict, Either, Future, List, Maybe, NotUsed, Try, Tuple } from '../../../shared/utils/fp'
import { decodeError } from '../../../shared/utils/ioTsUtils'

import { unknownToError } from '../../utils/unknownToError'

type MyMiddleware<I, O, A> = (c: Connection<I>) => Future<Tuple<A, Connection<O>>>

const URI = 'MyMiddleware' as const
type URI = typeof URI

declare module 'fp-ts/HKT' {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface URItoKind2<E, A> {
    [URI]: MyMiddleware<E, E, A>
  }
}

type DecoderWithName<A> = Tuple<Decoder<unknown, A>, string>

// alias to readonly

const Functor: Functor2<URI> = {
  URI,
  map: M.Functor.map as <I, A, B>(
    fa: MyMiddleware<I, I, A>,
    f: (a: A) => B,
  ) => MyMiddleware<I, I, B>,
}

const ApplyPar: Apply2<URI> = {
  ...Functor,
  ap: M.ApplyPar.ap as <I, A, B>(
    fab: MyMiddleware<I, I, (a: A) => B>,
    fa: MyMiddleware<I, I, A>,
  ) => MyMiddleware<I, I, B>,
}

const Monad: Monad2<URI> = {
  ...ApplyPar,
  of: M.of,
  chain: M.Monad.chain as <R, A, B>(
    fa: MyMiddleware<R, R, A>,
    f: (a: A) => MyMiddleware<R, R, B>,
  ) => MyMiddleware<R, R, B>,
}

const fromEither = M.fromEither as <I = StatusOpen, A = never>(fa: Try<A>) => MyMiddleware<I, I, A>
const fromIO = M.fromIO as FromIO2<URI>['fromIO']

const map = M.map as <A, B>(
  f: (a: A) => B,
) => <I>(fa: MyMiddleware<I, I, A>) => MyMiddleware<I, I, B>

const ichain = M.ichain as <A, O, Z, B>(
  f: (a: A) => MyMiddleware<O, Z, B>,
) => <I>(ma: MyMiddleware<I, O, A>) => MyMiddleware<I, Z, B>

const ichainTaskEitherK = <A, B>(
  f: (a: A) => Future<B>,
): (<I, O>(ma: MyMiddleware<I, O, A>) => MyMiddleware<I, O, B>) =>
  ichain(flow(f, fb => M.fromTaskEither(fb)))

const orElse = M.orElse as <I, O, A>(
  f: (e: Error) => MyMiddleware<I, O, A>,
) => (ma: MyMiddleware<I, O, A>) => MyMiddleware<I, O, A>

type MyCookieOptions = Omit<CookieOptions, 'maxAge'> & {
  maxAge?: MsDuration
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
        ? Try.success(undefined)
        : Try.failure(Error(expectedContentTypeToBeJSON)),
    ),
    ichain(() => getBodyString()),
    ichain(flow(json.parse, Either.mapLeft(unknownToError), e => fromEither<I, json.Json>(e))),
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
          Try.success,
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

const getRequest =
  <I = StatusOpen>(): MyMiddleware<I, I, http.IncomingMessage> =>
  conn =>
    Future.successful(Tuple.of(conn.getRequest(), conn))

const getBodyChunks = <I = StatusOpen>(): MyMiddleware<I, I, List<unknown>> =>
  pipe(getRequest<I>(), ichain(flow(requestChunks, f => M.fromTaskEither(f))))

const getUrl = <I = StatusOpen>(): MyMiddleware<I, I, string> =>
  pipe(
    getRequest<I>(),
    ichain(request =>
      request.url === undefined ? M.left(Error('request.url was undefined')) : M.right(request.url),
    ),
  )

const getBodyString = <I = StatusOpen>(): MyMiddleware<I, I, string> =>
  pipe(getBodyChunks<I>(), map(flow(List.map(String), List.mkString(''))))

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

const noContent = (headers: Dict<string, string> = {}): EndedMiddleware =>
  sendWithStatus(Status.NoContent, headers)('')

const jsonWithStatus =
  <O, A>(status: Status, encoder: Encoder<O, A>, headers: Dict<string, string> = {}) =>
  (data: A): EndedMiddleware =>
    pipe(
      reduceHeaders(status, headers),
      ichain(() => M.json(encoder.encode(data), unknownToError)),
    )

const jsonOK = <O, A>(
  encoder: Encoder<O, A>,
  headers: Dict<string, string> = {},
): ((data: A) => EndedMiddleware) => jsonWithStatus(Status.OK, encoder, headers)

// Express

const toRequestHandler = toRequestHandler_ as <I, O>(
  middleware: MyMiddleware<I, O, void>,
) => express.RequestHandler

const MyMiddleware = {
  ...M,
  ApplyPar,
  fromIO,
  map,
  ichain,
  ichainTaskEitherK,
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
  getUrl,
  getBodyString,
  sendWithStatus,
  noContent,
  jsonWithStatus,
  json: jsonOK,

  toRequestHandler,
}

type EndedMiddleware = MyMiddleware<StatusOpen, ResponseEnded, void>

const withBody =
  <A = never>(decoder: Decoder<unknown, A>) =>
  (f: (a: A) => EndedMiddleware): EndedMiddleware =>
    pipe(
      M.decodeHeader('Content-Type', contentType =>
        Either.right(
          contentType === MediaType.applicationJSON
            ? Either.right(NotUsed)
            : Either.left(expectedContentTypeToBeJSON),
        ),
      ),
      eitherT.chain(Monad)(() =>
        pipe(getBodyString(), map<string, Either<string, string>>(Either.right)),
      ),
      map(
        flow(
          Either.chain(
            flow(
              json.parse,
              Either.mapLeft(() => 'Invalid json'),
            ),
          ),
          Either.chain(
            flow(
              decoder.decode,
              Either.mapLeft(e => `Invalid body\n${D.draw(e)}`),
            ),
          ),
        ),
      ),
      ichain(Either.fold(sendWithStatus(Status.BadRequest), f)),
    )

const EndedMiddleware = { withBody }

export { MyMiddleware, EndedMiddleware }

const requestChunks = (req: http.IncomingMessage): Future<List<unknown>> =>
  Future.tryCatch(
    () =>
      new Promise<List<unknown>>((resolve, reject) => {
        const body: unknown[] = []

        /* eslint-disable functional/no-expression-statements */
        // eslint-disable-next-line functional/immutable-data
        req.on('data', chunk => body.push(chunk))
        req.on('end', () => resolve(body))
        req.on('error', e => reject(e))
        /* eslint-enable functional/no-expression-statements */
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

const expectedContentTypeToBeJSON = `Expected 'Content-Type' to be '${MediaType.applicationJSON}'`
