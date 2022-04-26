import React from 'react'

import { HistoryContextProvider } from './contexts/HistoryContext'
import { LogContextProvider } from './contexts/LogContext'
import { AppRouterComponent } from './router/AppRouterComponent'

export const App = (): JSX.Element => (
  <HistoryContextProvider>
    <LogContextProvider>
      <div className="w-[100vw] h-[100vh] font-[baloopaaji2] bg-gray3 text-gray4 overflow-hidden">
        <AppRouterComponent />
      </div>
    </LogContextProvider>
  </HistoryContextProvider>
)
