import { pipe } from 'fp-ts/function'

import type { NotUsed } from '../shared/utils/fp'
import { IO, toNotUsed } from '../shared/utils/fp'

import { Config } from './config/Config'

const main: IO<NotUsed> = pipe(Config.load, IO.map(toNotUsed))

// eslint-disable-next-line functional/no-expression-statements
IO.runUnsafe(main)
