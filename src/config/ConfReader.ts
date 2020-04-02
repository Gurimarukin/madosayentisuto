import * as Nea from 'fp-ts/lib/NonEmptyArray'
import { NonEmptyArray } from 'fp-ts/lib/NonEmptyArray'
import * as t from 'io-ts'

import { FileUtils } from '../utils/FileUtils'
import { unknownToError } from '../utils/IOUtils'

export type ValidatedNea<A> = Either<NonEmptyArray<string>, A>

export type ConfReader = <A>(
  codec: t.Decoder<unknown, A>
) => (path: string, ...paths: string[]) => ValidatedNea<A>

export namespace ConfReader {
  export function fromFiles(path: string, ...paths: string[]): IO<ConfReader> {
    return pipe(
      parseJsonFiles(path, ...paths),
      IO.map<NonEmptyArray<unknown>, ConfReader>(jsons =>
        fromJsons(Nea.head(jsons), Nea.tail(jsons))
      )
    )
  }

  export function fromJsons(json: unknown, ...jsons: unknown[]): ConfReader {
    return <A>(codec: t.Decoder<unknown, A>) => (
      path: string,
      ...paths: string[]
    ): ValidatedNea<A> => {
      const allPaths: NonEmptyArray<string> = [path, ...paths]
      return jsons.reduce<ValidatedNea<A>>(
        (acc, conf) =>
          pipe(
            acc,
            Either.orElse(_ => readPath(codec, allPaths, conf))
          ),
        readPath(codec, allPaths, json)
      )
    }
  }
}

function parseJsonFiles(path: string, ...paths: string[]): IO<NonEmptyArray<unknown>> {
  return paths.reduce(
    (acc, path) =>
      Do(IO.ioEither)
        .bindL('acc', () => acc)
        .bindL('newConf', () => loadConfigFile(path))
        .return(({ acc, newConf }) => Nea.snoc(acc, newConf)),
    pipe(loadConfigFile(path), IO.map(Nea.of))
  )
}

function loadConfigFile(path: string): IO<unknown> {
  return pipe(
    FileUtils.readFileSync(path),
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
