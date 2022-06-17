import React from 'react'

import { HistoryContextProvider } from './contexts/HistoryContext'
import { HttpContextProvider } from './contexts/HttpContext'
import { LogContextProvider } from './contexts/LogContext'
import { AppRouterComponent } from './router/AppRouterComponent'

export const App = (): JSX.Element => (
  <div className="overflow-hidden w-[100vw] h-[100vh] font-[baloopaaji2] text-gray4 bg-gray3">
    <HistoryContextProvider>
      <HttpContextProvider>
        <LogContextProvider>
          <AppRouterComponent />
        </LogContextProvider>
      </HttpContextProvider>
    </HistoryContextProvider>
  </div>
)
