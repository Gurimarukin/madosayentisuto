import React from 'react'

import { AppRouterComponent } from './router/AppRouterComponent'
import { HistoryContextProvider } from './router/HistoryContext'

export const App = (): JSX.Element => (
  <HistoryContextProvider>
    <AppRouterComponent />
  </HistoryContextProvider>
)
