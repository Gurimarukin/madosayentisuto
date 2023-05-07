/* eslint-disable functional/no-return-void,
                  functional/no-expression-statements */
import { pipe } from 'fp-ts/function'
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

import { apiRoutes } from '../../shared/ApiRouter'
import { DayJs } from '../../shared/models/DayJs'
import type { ServerToClientEvent } from '../../shared/models/event/ServerToClientEvent'
import type { Log } from '../../shared/models/log/Log'
import { LogsWithCount } from '../../shared/models/log/LogsWithCount'
import { TObservable } from '../../shared/models/rx/TObservable'
import { Future, IO, List, NotUsed } from '../../shared/utils/fp'

import { getOnError } from '../utils/getOnError'
import { useHttp } from './HttpContext'
import { useServerClientWS } from './ServerClientWSContext'

type LogContext = {
  logs: List<Log>
  count: number
  tryRefetchInitialLogs: () => void
}

const LogContext = createContext<LogContext | undefined>(undefined)

export const LogContextProvider: React.FC = ({ children }) => {
  const { http } = useHttp()
  const { serverToClientEventObservable } = useServerClientWS()

  const [logs, setLogs] = useState<List<Log>>([])
  const [count, setCount] = useState(0)

  const initialLogsFetched = useRef(false)
  const fetchInitialLogs = useCallback(
    (): Future<NotUsed> =>
      initialLogsFetched.current
        ? Future.notUsed
        : pipe(
            Future.tryCatch(() =>
              http(apiRoutes.logs.get, {}, [LogsWithCount.codec, 'LogsWithCount']),
            ),
            Future.map(init => {
              setLogs(prev => pipe(init.logs, List.concat(prev)))
              setCount(init.count)
              // eslint-disable-next-line functional/immutable-data
              initialLogsFetched.current = true
              return NotUsed
            }),
          ),
    [http],
  )

  useEffect(() => {
    const subscription = pipe(
      serverToClientEventObservable,
      TObservable.subscribe(getOnError)({ next: onServerToClientEvent }),
      IO.chainFirstIOK(() => pipe(fetchInitialLogs(), IO.runFuture(getOnError))),
      IO.runUnsafe,
    )
    return () => subscription.unsubscribe()

    function onServerToClientEvent(e: ServerToClientEvent): Future<NotUsed> {
      switch (e.type) {
        case 'Log':
          const { name, level, message } = e
          return pipe(
            DayJs.now,
            Future.fromIO,
            Future.map(date => {
              setLogs(List.append({ date, name, level, message }))
              setCount(n => n + 1)
              return NotUsed
            }),
          )
        case 'GuildStateUpdated':
          return Future.notUsed
      }
    }
  }, [fetchInitialLogs, serverToClientEventObservable])

  const tryRefetchInitialLogs = useCallback(
    (): Promise<NotUsed> => Future.run(getOnError)(fetchInitialLogs()),
    [fetchInitialLogs],
  )

  const value: LogContext = {
    logs,
    count,
    tryRefetchInitialLogs,
  }

  return <LogContext.Provider value={value}>{children}</LogContext.Provider>
}

export const useLog = (): LogContext => {
  const context = useContext(LogContext)
  if (context === undefined) {
    // eslint-disable-next-line functional/no-throw-statements
    throw Error('useLog must be used within a LogContextProvider')
  }
  return context
}
