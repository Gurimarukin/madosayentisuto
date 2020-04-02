import * as Nea from 'fp-ts/lib/NonEmptyArray'
import { NonEmptyArray } from 'fp-ts/lib/NonEmptyArray'
import * as t from 'io-ts'

import { FileUtils } from '../utils/FileUtils'
import { unknownToError } from '../utils/IOUtils'

export type ValidatedNea<A> = Either<NonEmptyArray<string>, A>

export type ConfReader = <A>(
  codec: t.Decoder<unknown, A>
) => (path: string, ...paths: string[]) => Either<NonEmptyArray<string>, A>

export namespace ConfReader {
  export function load(file: string, ...files: string[]): IO<ConfReader> {
    return pipe(
      loadConfigFiles(file, ...files),
      IO.map<NonEmptyArray<unknown>, ConfReader>(
        jsons => <A>(codec: t.Decoder<unknown, A>) => (
          path: string,
          ...paths: string[]
        ): ValidatedNea<A> => {
          const allPaths: NonEmptyArray<string> = [path, ...paths]
          return Nea.tail(jsons).reduce<ValidatedNea<A>>(
            (acc, conf) =>
              pipe(
                acc,
                Either.orElse(_ => readPath(codec, allPaths, conf))
              ),
            readPath(codec, allPaths, Nea.head(jsons))
          )
        }
      )
    )
  }
}

function loadConfigFiles(file: string, ...files: string[]): IO<NonEmptyArray<unknown>> {
  return files.reduce(
    (acc, file) =>
      Do(IO.ioEither)
        .bindL('acc', () => acc)
        .bindL('newConf', () => loadConfigFile(file))
        .return(({ acc, newConf }) => Nea.snoc(acc, newConf)),
    pipe(loadConfigFile(file), IO.map(Nea.of))
  )
}

function loadConfigFile(file: string): IO<unknown> {
  return pipe(
    FileUtils.readFileSync(file),
    IO.chain(_ => IO.fromEither(Either.parseJSON(_, unknownToError)))
  )
}

function readPath<A>(
  codec: t.Decoder<unknown, A>,
  paths: NonEmptyArray<string>,
  json: unknown
): ValidatedNea<A> {
  return pipe(
    readPathRec(paths, json),
    Either.chain(val =>
      pipe(
        codec.decode(val),
        Either.mapLeft(
          errors =>
            errors.map(_ => `expected ${codec.name} got ${_.value}`) as NonEmptyArray<string>
        )
      )
    ),
    Either.mapLeft(Nea.map(_ => `key ${paths.join('.')}: ${_}`))
  )
}

function readPathRec(paths: string[], val: unknown): ValidatedNea<unknown> {
  if (List.isEmpty(paths)) return Either.right(val)

  const [head, ...tail] = paths
  return pipe(
    Either.tryCatch(
      () => (val as any)[head],
      _ => Nea.of('missing key')
    ),
    Either.chain(newVal => readPathRec(tail, newVal))
  )
}
