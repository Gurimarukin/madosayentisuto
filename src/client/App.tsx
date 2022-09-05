import React from 'react'

import { HistoryContextProvider } from './contexts/HistoryContext'
import { HttpContextProvider } from './contexts/HttpContext'
import { LogContextProvider } from './contexts/LogContext'
import { AppRouterComponent } from './router/AppRouterComponent'

export const App = (): JSX.Element => (
  <div className="h-[100vh] w-[100vw] overflow-hidden bg-gray3 font-[baloopaaji2] text-gray4">
    <HistoryContextProvider>
      <HttpContextProvider>
        <LogContextProvider>
          <AppRouterComponent />
        </LogContextProvider>
      </HttpContextProvider>
    </HistoryContextProvider>
  </div>
)
