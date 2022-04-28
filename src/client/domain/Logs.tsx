/* eslint-disable functional/no-expression-statement */
import { pipe } from 'fp-ts/function'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { DayJs } from '../../shared/models/DayJs'
import { LogEvent } from '../../shared/models/event/LogEvent'
import { LogLevel } from '../../shared/models/log/LogLevel'
import type { Color } from '../../shared/utils/Color'

import { Header } from '../components/Header'
import { useLog } from '../contexts/LogContext'

export const Logs = (): JSX.Element => {
  const { logs, totalCount, tryRefetchInitialLogs } = useLog()

  useEffect(() => {
    tryRefetchInitialLogs()
  }, [tryRefetchInitialLogs])

  const [selectedLevel, setSelectedLevel] = useState<LogLevel>('info')
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => setSelectedLevel(e.target.value as LogLevel),
    [],
  )

  const filteredLogs = useMemo(
    () => logs.filter(LogEvent.filter(selectedLevel)),
    [logs, selectedLevel],
  )

  const [isFollowingScroll, setIsFollowingScroll] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  const handleScroll = useCallback(() => {
    if (scrollRef.current === null) return
    const { scrollTop, offsetHeight, scrollHeight } = scrollRef.current
    setIsFollowingScroll(scrollTop + offsetHeight === scrollHeight)
  }, [])

  const scrollDown = useCallback(() => {
    if (scrollRef.current === null) return
    scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    if (isFollowingScroll) scrollDown()
  }, [logs, isFollowingScroll, scrollDown])

  return (
    <div className="flex flex-col h-full">
      <Header>
        <div className="flex gap-8 items-center">
          <h1 className="text-3xl">Console</h1>
          <div className="flex gap-2">
            <span>Total logs :</span>
            <pre>{totalCount}</pre>
          </div>
          <div className="flex gap-2 items-center">
            <span>Niveau de log :</span>
            <select
              value={selectedLevel}
              onChange={handleChange}
              className="py-1 font-mono text-sm text-gray1 bg-gray4 rounded-sm border-none"
            >
              {LogLevel.values.map(level => (
                <option key={level} value={level} className="font-mono text-xs cursor-pointer">
                  {level.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={scrollDown}
            className="py-1 px-2 text-sm bg-gray1 rounded-md border border-gray4 cursor-pointer"
          >
            Scroll en bas
          </button>
        </div>
      </Header>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="overflow-x-hidden overflow-y-auto grow pt-2 pr-4 pb-6 pl-3 bg-black"
      >
        <pre className="grid grid-cols-[min-content_min-content_1fr] gap-x-3 w-full text-sm">
          {filteredLogs.map(({ date, name, level, message }, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <div key={i} className="contents">
              {color(level.toUpperCase(), LogLevel.hexColor[level])}
              {color(
                pipe(date, DayJs.format('YYYY/MM/DD HH:mm:ss', { locale: true })),
                LogLevel.hexColor.debug,
              )}
              <span className="whitespace-pre-wrap break-all">
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
