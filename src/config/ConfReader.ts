import * as Nea from 'fp-ts/lib/NonEmptyArray'
import { NonEmptyArray } from 'fp-ts/lib/NonEmptyArray'
import * as t from 'io-ts'

import { FileUtils } from '../utils/FileUtils'
import { unknownToError } from '../utils/unknownToError'
import { Either, pipe, IO, Maybe, Do, List } from '../utils/fp'

export type ValidatedNea<A> = Either<NonEmptyArray<string>, A>

export type ConfReader = <A>(
  codec: t.Decoder<unknown, A>
) => (path: string, ...paths: string[]) => ValidatedNea<A>

export namespace ConfReader {
  export const fromFiles = (path: string, ...paths: string[]): IO<ConfReader> =>
    pipe(
      parseJsonFiles(path, ...paths),
      IO.map<NonEmptyArray<unknown>, ConfReader>(jsons =>
        fromJsons(Nea.head(jsons), ...Nea.tail(jsons))
      )
    )

  export const fromJsons = (json: unknown, ...jsons: unknown[]): ConfReader => <A>(
    codec: t.Decoder<unknown, A>
  ) => (path: string, ...paths: string[]): ValidatedNea<A> => {
    const allPaths: NonEmptyArray<string> = [path, ...paths]

    const valueForPath = pipe(
      jsons.reduce<Maybe<unknown>>(
        (acc, json) =>
          pipe(
            acc,
            Maybe.alt(() => readPath(allPaths, json))
          ),
        readPath(allPaths, json)
      ),
      Either.fromOption(() => Nea.of('missing key'))
    )

    return pipe(
      valueForPath,
      Either.chain(val =>
        pipe(
          codec.decode(val),
          Either.mapLeft(
            errors =>
              errors.map(
                _ => `expected ${codec.name} got ${JSON.stringify(_.value)}`
              ) as NonEmptyArray<string>
          )
        )
      ),
      Either.mapLeft(Nea.map(_ => `key ${allPaths.join('.')}: ${_}`))
    )
  }
}

const parseJsonFiles = (path: string, ...paths: string[]): IO<NonEmptyArray<unknown>> =>
  paths.reduce(
    (acc, path) =>
      Do(IO.ioEither)
        .bindL('acc', () => acc)
        .bindL('newConf', () => loadConfigFile(path))
        .return(({ acc, newConf }) => Nea.snoc(acc, newConf)),
    pipe(loadConfigFile(path), IO.map(Nea.of))
  )

const loadConfigFile = (path: string): IO<unknown> =>
  pipe(
    FileUtils.readFileSync(path),
    IO.chain(_ => IO.fromEither(Either.parseJSON(_, unknownToError)))
  )

const readPath = (paths: string[], val: unknown): Maybe<unknown> => {
  if (List.isEmpty(paths)) return Maybe.some(val)

  const [head, ...tail] = paths
  return pipe(
    Maybe.tryCatch(() => (val as any)[head]),
    Maybe.filter(_ => _ !== undefined),
    Maybe.chain(newVal => readPath(tail, newVal))
  )
}
