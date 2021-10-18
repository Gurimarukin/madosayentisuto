import * as D from 'io-ts/Decoder'

import { ValidatedNea } from '../models/ValidatedNea'
import { FileUtils } from '../utils/FileUtils'
import { Do, Either, IO, List, Maybe, NonEmptyArray, flow, pipe } from '../utils/fp'
import { StringUtils } from '../utils/StringUtils'
import { unknownToError } from '../utils/unknownToError'

export type ConfReader = <A>(
  decoder: D.Decoder<unknown, A>
) => (path: string, ...paths: ReadonlyArray<string>) => ValidatedNea<string, A>

export namespace ConfReader {
  export const fromFiles = (path: string, ...paths: ReadonlyArray<string>): IO<ConfReader> =>
    pipe(
      parseJsonFiles(path, ...paths),
      IO.map<NonEmptyArray<unknown>, ConfReader>(jsons =>
        fromJsons(NonEmptyArray.head(jsons), ...NonEmptyArray.tail(jsons)),
      ),
    )

  export function fromJsons(json: unknown, ...jsons: ReadonlyArray<unknown>): ConfReader {
    return <A>(decoder: D.Decoder<unknown, A>) => (
      path: string,
      ...paths: ReadonlyArray<string>
    ): ValidatedNea<string, A> => {
      const allPaths: NonEmptyArray<string> = List.cons(path, paths)

      const valueForPath = pipe(
        jsons,
        List.reduce(readPath(allPaths, json), (acc, json) =>
          pipe(
            acc,
            Maybe.alt(() => readPath(allPaths, json)),
          ),
        ),
        Either.fromOption(() => NonEmptyArray.of('missing key')),
      )

      return pipe(
        valueForPath,
        Either.chain(val =>
          pipe(decoder.decode(val), Either.mapLeft(flow(D.draw, NonEmptyArray.of))),
        ),
        ValidatedNea.fromEmptyErrors,
        Either.mapLeft(
          NonEmptyArray.map(_ => pipe(allPaths, StringUtils.mkString('key ', '.', `: ${_}`))),
        ),
      )
    }
  }
}

function parseJsonFiles(path: string, ...paths: ReadonlyArray<string>): IO<NonEmptyArray<unknown>> {
  return paths.reduce(
    (acc, path) =>
      Do(IO.ioEither)
        .bindL('acc', () => acc)
        .bindL('newConf', () => loadConfigFile(path))
        .return(({ acc, newConf }) => NonEmptyArray.snoc(acc, newConf)),
    pipe(loadConfigFile(path), IO.map(NonEmptyArray.of)),
  )
}

function loadConfigFile(path: string): IO<unknown> {
  return pipe(
    FileUtils.readFileSync(path),
    IO.chain(_ => IO.fromEither(Either.parseJSON(_, unknownToError))),
  )
}

function readPath(paths: ReadonlyArray<string>, val: unknown): Maybe<unknown> {
  if (List.isEmpty(paths)) return Maybe.some(val)

  const [head, ...tail] = paths
  return pipe(
    Maybe.tryCatch(() => (val as any)[head]),
    Maybe.filter(_ => _ !== undefined),
    Maybe.chain(newVal => readPath(tail, newVal)),
  )
}
