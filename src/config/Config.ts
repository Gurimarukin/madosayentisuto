import { sequenceT } from 'fp-ts/lib/Apply'
import * as Nea from 'fp-ts/lib/NonEmptyArray'
import * as t from 'io-ts'

import { ConfReader, ValidatedNea } from './ConfReader'

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
    return pipe(
      ConfReader.load('./conf/local.conf.json', './conf/application.conf.json'),
      IO.chain(reader =>
        pipe(
          validateConfig(reader),
          Either.mapLeft(errors => new Error(`Errors while reading config:\n${errors.join('\n')}`)),
          IO.fromEither
        )
      )
    )
  }
}

function validateConfig(reader: ConfReader): ValidatedNea<Config> {
  return pipe(
    sequenceT(Either.getValidation(Nea.getSemigroup<string>()))(
      reader(t.string)('name'),
      reader(t.string)('discord', 'clientSecret')
    ),
    Either.map(([name, clientSecret]) => Config(name, clientSecret))
  )
}
