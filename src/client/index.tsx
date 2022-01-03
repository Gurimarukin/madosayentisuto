import * as React from 'react'
import * as ReactDOM from 'react-dom'

import { App } from './App'
import { HistoryContextProvider } from './router/HistoryContext'

// eslint-disable-next-line functional/no-expression-statement
ReactDOM.render(
  <HistoryContextProvider>
    <App />
  </HistoryContextProvider>,
  document.getElementById('root'),
)
