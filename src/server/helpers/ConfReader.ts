import { apply, json } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'
import * as D from 'io-ts/Decoder'

import { ValidatedNea } from '../../shared/models/ValidatedNea'
import { StringUtils } from '../../shared/utils/StringUtils'
import { Dict, Either, IO, List, Maybe, NonEmptyArray } from '../../shared/utils/fp'

import { FileUtils } from '../utils/FileUtils'
import { unknownToError } from '../utils/unknownToError'

export type ConfReader = <A>(
  decoder: D.Decoder<unknown, A>,
) => (path: string, ...paths: List<string>) => ValidatedNea<string, A>

const fromFiles = (path: string, ...paths: List<string>): IO<ConfReader> =>
  pipe(
    parseJsonFiles(path, ...paths),
    IO.map<NonEmptyArray<unknown>, ConfReader>(jsons =>
      fromJsons(NonEmptyArray.head(jsons), ...NonEmptyArray.tail(jsons)),
    ),
  )

const fromJsons =
  (json_: unknown, ...jsons: List<unknown>): ConfReader =>
  <A>(decoder: D.Decoder<unknown, A>) =>
  (path: string, ...paths: List<string>): ValidatedNea<string, A> => {
    const allPaths: NonEmptyArray<string> = pipe(paths, List.prepend(path))

    const valueForPath = pipe(
      jsons,
      List.reduce(readPath(allPaths, json_), (acc, u) =>
        pipe(
          acc,
          Maybe.alt(() => readPath(allPaths, u)),
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
        NonEmptyArray.map(s => pipe(allPaths, StringUtils.mkString('key ', '.', `: ${s}`))),
      ),
    )
  }

export const ConfReader = { fromFiles, fromJsons }

const parseJsonFiles = (path: string, ...paths: List<string>): IO<NonEmptyArray<unknown>> =>
  paths.reduce(
    (acc_, path_) =>
      pipe(
        apply.sequenceS(IO.ApplyPar)({
          acc: acc_,
          newConf: loadConfigFile(path_),
        }),
        IO.map(({ acc, newConf }) => NonEmptyArray.snoc(acc, newConf)),
      ),
    pipe(loadConfigFile(path), IO.map(NonEmptyArray.of)),
  )

const loadConfigFile = (path: string): IO<unknown> =>
  pipe(
    FileUtils.readFileSync(path),
    IO.chain(s => pipe(s, json.parse, Either.mapLeft(unknownToError), IO.fromEither)),
  )

const readPath = (paths: List<string>, val: unknown): Maybe<unknown> => {
  if (List.isNonEmpty(paths)) {
    const [head, ...tail] = paths
    return pipe(
      Maybe.tryCatch(() => pipe(val as Dict<string, unknown>, Dict.lookup(head))),
      Maybe.chain(Maybe.chain(newVal => readPath(tail, newVal))),
    )
  }
  return Maybe.some(val)
}
