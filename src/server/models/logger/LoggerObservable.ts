import { pipe } from 'fp-ts/function'
import type * as rxjs from 'rxjs'
import util from 'util'

import type { LoggerType } from '../../../shared/models/LoggerType'
import { LogEvent } from '../../../shared/models/event/LogEvent'
import type { LogLevel, LogLevelOrOff } from '../../../shared/models/log/LogLevel'
import { PubSub } from '../../../shared/models/rx/PubSub'
import { TObservable } from '../../../shared/models/rx/TObservable'
import type { TObserver } from '../../../shared/models/rx/TObserver'
import { LogUtils } from '../../../shared/utils/LogUtils'
import type { NotUsed } from '../../../shared/utils/fp'
import { IO, NonEmptyArray } from '../../../shared/utils/fp'

export type LoggerObservable = {
  readonly Logger: LoggerGetter
  readonly subscribe: SubscribeLogEvent
}

export type LoggerGetter = (name: string) => LoggerType

type SubscribeLogEvent = (
  configLevel: LogLevelOrOff,
  observer: TObserver<LogEvent>,
) => IO<rxjs.Subscription>

const init = (): LoggerObservable => {
  const Logger: LoggerGetter = name => ({
    debug: (...params) => log(name, 'debug', util.format(...params)),
    info: (...params) => log(name, 'info', util.format(...params)),
    warn: (...params) => log(name, 'warn', util.format(...params)),
    error: (...params) => log(name, 'error', util.format(...params)),
  })

  const logger = Logger('LoggerObservable')

  const logEventPubSub = PubSub<LogEvent>()

  return {
    Logger,
    subscribe: (configLevel, observer) =>
      pipe(
        logEventPubSub.observable,
        TObservable.filter(LogEvent.filter(configLevel)),
        TObservable.subscribe(LogUtils.onError(logger))(observer),
      ),
  }

  function log(name: string, level: LogLevel, message: string): IO<NotUsed> {
    return logEventPubSub.subject.next({ name, level, message })
  }
}

const initAndSubscribe = (
  ...observers: NonEmptyArray<Parameters<SubscribeLogEvent>>
): IO<LoggerObservable> => {
  const loggerObservable = init()
  return pipe(
    observers,
    NonEmptyArray.traverse(IO.ApplicativePar)(args => loggerObservable.subscribe(...args)),
    IO.map(() => loggerObservable),
  )
}

export const LoggerObservable = { initAndSubscribe }
