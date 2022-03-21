import { pipe } from 'fp-ts/function'

import { Future, toUnit } from '../shared/utils/fp'

import { Config } from './Config'

const main: Future<void> = pipe(Config.load, Future.fromIOEither, Future.map(toUnit))

// eslint-disable-next-line functional/no-expression-statement
Future.runUnsafe(main)
