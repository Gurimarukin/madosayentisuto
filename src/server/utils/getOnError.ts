import { io } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'

import { DayJs } from '../../shared/models/DayJs'
import type { LoggerType } from '../../shared/models/LoggerType'
import type { NotUsed } from '../../shared/utils/fp'
import { Either, toNotUsed } from '../../shared/utils/fp'

import { consoleLogFormat } from '../models/logger/observers/ConsoleLogObserver'
import { utilInspect } from './utilInspect'

export const getOnError =
  (logger: LoggerType) =>
  (e: Error): io.IO<NotUsed> =>
    pipe(
      logger.error(e),
      io.chain(
        Either.fold(
          () =>
            pipe(
              DayJs.now,
              io.map(
                flow(
                  consoleLogFormat('LogUtils', 'error', utilInspect(e)),
                  console.error,
                  toNotUsed,
                ),
              ),
            ),
          io.of,
        ),
      ),
    )
