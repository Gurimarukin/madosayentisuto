/* eslint-disable functional/no-return-void */
import * as history from 'history'
import qs from 'qs'
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

type HistoryContext = {
  readonly location: history.Location
  readonly navigate: (to: string) => void
  readonly query: qs.ParsedQs
}

const HistoryContext = createContext<HistoryContext | undefined>(undefined)

export const HistoryContextProvider: React.FC = ({ children }) => {
  const h = useMemo(() => history.createBrowserHistory(), [])

  const [location, setLocation] = useState(h.location)
  useEffect(() => h.listen(l => setLocation(l.location)), [h])

  const navigate = useCallback((to: string) => h.push({ pathname: to, search: '', hash: '' }), [h])

  const query = useMemo(() => qs.parse(location.search.slice(1)), [location.search])

  const value: HistoryContext = { location, navigate, query }

  return <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>
}

export const useHistory = (): HistoryContext => {
  const context = useContext(HistoryContext)
  if (context === undefined) {
    // eslint-disable-next-line functional/no-throw-statement
    throw Error('useHistory must be used within a HistoryContextProvider')
  }
  return context
}
