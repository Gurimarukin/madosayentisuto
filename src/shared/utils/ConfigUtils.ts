import * as dotenv from 'dotenv'
import { flow, pipe } from 'fp-ts/function'
import * as D from 'io-ts/Decoder'

import type { ValidatedNea } from '../models/ValidatedNea'
import { StringUtils } from './StringUtils'
import type { Try } from './fp'
import { Either, IO, NonEmptyArray } from './fp'

export type DecodeKey = <B>(
  decoder: D.Decoder<unknown, B>,
) => (key: string) => ValidatedNea<string, B>

const loadDotEnv: IO<dotenv.DotenvParseOutput> = pipe(
  IO.tryCatch(() => dotenv.config()),
  IO.chain(result =>
    result.parsed !== undefined
      ? IO.right(result.parsed)
      : result.error !== undefined
      ? IO.left(result.error)
      : IO.left(Error('result.error was undefined')),
  ),
)

const parseConfig =
  (dict: dotenv.DotenvParseOutput) =>
  <A>(f: (r: DecodeKey) => ValidatedNea<string, A>): Try<A> =>
    pipe(
      f(
        <B>(decoder: D.Decoder<unknown, B>) =>
          (key: string) =>
            pipe(
              decoder.decode(dict[key]),
              Either.mapLeft(e => NonEmptyArray.of(`${key}: ${D.draw(e)}`)),
            ),
      ),
      Either.mapLeft(flow(StringUtils.mkString('Errors while reading config:\n', '\n', ''), Error)),
    )

export const ConfigUtils = { loadDotEnv, parseConfig }
