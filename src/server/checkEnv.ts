import { pipe } from 'fp-ts/function'

import { IO, toUnit } from '../shared/utils/fp'

import { Config } from './Config'

const main: IO<void> = pipe(Config.load, IO.map(toUnit))

// eslint-disable-next-line functional/no-expression-statement
IO.runUnsafe(main)
