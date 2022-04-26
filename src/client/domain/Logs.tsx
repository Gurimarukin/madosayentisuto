import { pipe } from 'fp-ts/function'
import React from 'react'

import { DayJs } from '../../shared/models/DayJs'
import { LogLevel } from '../../shared/models/LogLevel'
import type { Color } from '../../shared/utils/Color'

import { Header } from '../components/Header'
import { useLog } from '../contexts/LogContext'

export const Logs = (): JSX.Element => {
  const { logs } = useLog()

  return (
    <div className="h-full flex flex-col">
      <Header>Console</Header>
      <div className="flex-grow px-3 py-2 bg-black overflow-x-hidden overflow-y-auto">
        <pre className="w-full grid grid-cols-[min-content_min-content_1fr] gap-x-3 text-sm">
          {logs.map(({ date, name, level, message }, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <div key={i} className="contents">
              {color(level.toUpperCase(), LogLevel.hexColor[level])}
              {color(
                pipe(date, DayJs.format('YYYY/MM/DD HH:mm:ss', { locale: true })),
                LogLevel.hexColor.debug,
              )}
              <span className="whitespace-pre-wrap">
                {name} - {message}
              </span>
            </div>
          ))}
        </pre>
      </div>
    </div>
  )
}

const color = (str: string, col: Color): JSX.Element => <span style={{ color: col }}>{str}</span>
