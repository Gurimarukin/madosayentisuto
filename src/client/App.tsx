import type React from 'react'

import { HistoryContextProvider } from './contexts/HistoryContext'
import { HttpContextProvider } from './contexts/HttpContext'
import { LogContextProvider } from './contexts/LogContext'
import { ServerClientWSContextProvider } from './contexts/ServerClientWSContext'
import { AppRouterComponent } from './router/AppRouterComponent'

export const App: React.FC = () => (
  <div className="h-screen w-screen overflow-hidden bg-gray3 font-[baloopaaji2] text-gray4">
    <HistoryContextProvider>
      <HttpContextProvider>
        <ServerClientWSContextProvider>
          <LogContextProvider>
            <AppRouterComponent />
          </LogContextProvider>
        </ServerClientWSContextProvider>
      </HttpContextProvider>
    </HistoryContextProvider>
  </div>
)
