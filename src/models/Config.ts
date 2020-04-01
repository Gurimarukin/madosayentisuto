import fs from 'fs'
import * as t from 'io-ts'
import { sequenceT } from 'fp-ts/lib/Apply'
import { getSemigroup, NonEmptyArray } from 'fp-ts/lib/NonEmptyArray'

export interface Config {
  name: string
  discord: {
    clientSecret: string
  }
}
export function Config(name: string, clientSecret: string): Config {
  return { name, discord: { clientSecret } }
}

export namespace Config {
  export function load(): IO<Config> {
    return Do(IO.ioEither)
      .bindL('applicationConf', () => readFile('./conf/application.conf.json'))
      .bindL('localConf', () => readFile('./conf/local.conf.json'))
      .bindL('res', ({ applicationConf, localConf }) => () =>
        validateConfig(applicationConf, localConf)
      )
      .return(({ res }) => res)
  }
}

function readFile(file: string): IO<unknown> {
  const fileContent: IO<string> = () =>
    Either.tryCatch(
      () => fs.readFileSync(file, 'utf8'),
      _ => _
    )

  return pipe(
    fileContent,
    IO.chain(_ => () => Either.parseJSON(_, identity))
  )
}

function validateConfig(
  applicationConf: unknown,
  localConf: unknown
): Either<NonEmptyArray<string>, Config> {
  const read = getReadPath(applicationConf, localConf)

  return pipe(
    sequenceT(Either.getValidation(getSemigroup<string>()))(
      read(t.string)('name'),
      read(t.string)('discord', 'clientSecret')
    ),
    Either.map(([name, clientSecret]) => Config(name, clientSecret))
  )
}

function getReadPath(
  applicationConf: unknown,
  localConf: unknown
): <A>(
  codec: t.Decoder<unknown, A>
) => (path: string, ...paths: string[]) => Either<NonEmptyArray<string>, A> {
  return codec => (path, ...paths) =>
    pipe(
      readPath(codec)(path, ...paths)(localConf),
      Either.orElse(_ => readPath(codec)(path, ...paths)(applicationConf))
    )
}

function readPath<A>(
  codec: t.Decoder<unknown, A>
): (path: string, ...paths: string[]) => (u: unknown) => Either<NonEmptyArray<string>, A> {
  return (path, ...paths) => u => {
    const allPaths = [path, ...paths]
    return pipe(
      readPathRec(u, allPaths),
      Either.chain(u =>
        pipe(
          codec.decode(u),
          Either.mapLeft(
            errors =>
              errors.map(_ => `expected ${codec.name} got ${_.value}`) as NonEmptyArray<string>
          )
        )
      ),
      Either.mapLeft(_ => _.map(_ => `key ${allPaths.join('.')}: ${_}`) as NonEmptyArray<string>)
    )
  }
}

function readPathRec(u: unknown, paths: string[]): Either<NonEmptyArray<string>, unknown> {
  if (Seq.isEmpty(paths)) return Either.right(u)
  const [head, ...tail] = paths
  return pipe(
    Either.tryCatch<NonEmptyArray<string>, any>(
      () => (u as any)[head],
      _ => ['missing key']
    ),
    Either.chain(newU => readPathRec(newU, tail))
  )
}
