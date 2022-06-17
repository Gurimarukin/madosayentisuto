import * as React from 'react'
import * as ReactDOM from 'react-dom'

import { App } from './App'
import { HTML5Backend } from './libs/backend-html5'
import { DndProvider } from './libs/react-dnd'

// eslint-disable-next-line functional/no-expression-statement
ReactDOM.render(
  <DndProvider backend={HTML5Backend}>
    <App />
  </DndProvider>,

  document.getElementById('root'),
)
