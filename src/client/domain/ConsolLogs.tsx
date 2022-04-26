import { pipe } from 'fp-ts/function'
import React from 'react'

import { DayJs } from '../../shared/models/DayJs'
import { LogLevel } from '../../shared/models/LogLevel'
import { MsDuration } from '../../shared/models/MsDuration'
import type { Color } from '../../shared/utils/Color'

import { Header } from '../components/Header'
import { useConsole } from '../contexts/ConsoleContext'

export const ConsolLogs = (): JSX.Element => {
  const { logs } = useConsole()

  return (
    <div className="h-full flex flex-col">
      <Header>ConsoleLog</Header>
      <div className="flex-grow px-3 py-2 bg-black overflow-x-hidden overflow-y-auto">
        <pre className="w-full grid grid-cols-[min-content_min-content_1fr] gap-x-3 text-sm">
          {logs.map(({ date, name, level, message }) => (
            <div key={pipe(date, DayJs.unixMs, MsDuration.unwrap)} className="contents">
              {color(level.toUpperCase(), LogLevel.hexColor[level])}
              {color(pipe(date, DayJs.format('YYYY/MM/DD HH:mm:ss')), LogLevel.hexColor.debug)}
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
