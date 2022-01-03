import React from 'react'

import { useHistory } from './router/HistoryContext'
import { Router } from './router/Router'

export const App = (): JSX.Element => {
  const { location } = useHistory()

  return <Router path={location.pathname} />
}
