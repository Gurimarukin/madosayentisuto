import { createRoot } from 'react-dom/client'

import { App } from './App'
import { HTML5Backend } from './libs/backend-html5'
import { DndProvider } from './libs/react-dnd'

const rootEltId = 'root'
const rootElt = document.getElementById(rootEltId)

if (rootElt === null) {
  // eslint-disable-next-line functional/no-throw-statements
  throw Error(`root element not found: #${rootEltId}`)
}

const root = createRoot(rootElt)

// eslint-disable-next-line functional/no-expression-statements
root.render(
  <DndProvider backend={HTML5Backend}>
    <App />
  </DndProvider>,
)
