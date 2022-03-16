import * as dotenv from 'dotenv'
import { pipe } from 'fp-ts/function'

import type { Dict } from '../fp'
import { IO } from '../fp'

export const loadDotEnv: IO<Dict<string, string>> = pipe(
  IO.tryCatch(() => dotenv.config()),
  IO.chain(result =>
    result.parsed !== undefined
      ? IO.right(result.parsed)
      : result.error !== undefined
      ? IO.left(result.error)
      : IO.left(Error('result.error was undefined')),
  ),
)
