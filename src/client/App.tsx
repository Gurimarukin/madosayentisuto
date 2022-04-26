import React from 'react'

import { AppRouterComponent } from './router/AppRouterComponent'
import { HistoryContextProvider } from './router/HistoryContext'

export const App = (): JSX.Element => (
  <HistoryContextProvider>
    <div className="w-[100vw] h-[100vh] font-[baloopaaji2] bg-gray3 text-gray4 overflow-hidden">
      <AppRouterComponent />
    </div>
  </HistoryContextProvider>
)
