import { io } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import type { NotUsed } from '../../shared/utils/fp'
import { Either, toNotUsed } from '../../shared/utils/fp'

import { logger } from './logger'

export const getOnError = (e: Error): io.IO<NotUsed> =>
  pipe(
    logger.error(e),
    io.chain(Either.fold(() => pipe(() => console.error(e), io.map(toNotUsed)), io.of)),
  )
