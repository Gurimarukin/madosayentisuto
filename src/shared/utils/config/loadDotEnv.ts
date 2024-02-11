import * as dotenv from 'dotenv'
import { pipe } from 'fp-ts/function'

import type { Dict } from '../fp'
import { IO } from '../fp'

console.log('process.env =', process.env)

export const loadDotEnv: IO<Dict<string, string | undefined>> = pipe(
  IO.tryCatch(() => dotenv.config()),
  IO.chain(result =>
    result.parsed !== undefined
      ? IO.right(process.env)
      : result.error !== undefined
        ? IO.left(result.error)
        : IO.left(Error('result.error was undefined')),
  ),
)
