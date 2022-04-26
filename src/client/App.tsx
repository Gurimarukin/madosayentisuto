import React from 'react'

import { ConsoleContextProvider } from './contexts/ConsoleContext'
import { HistoryContextProvider } from './contexts/HistoryContext'
import { AppRouterComponent } from './router/AppRouterComponent'

export const App = (): JSX.Element => (
  <HistoryContextProvider>
    <ConsoleContextProvider>
      <div className="w-[100vw] h-[100vh] font-[baloopaaji2] bg-gray3 text-gray4 overflow-hidden">
        <AppRouterComponent />
      </div>
    </ConsoleContextProvider>
  </HistoryContextProvider>
)
