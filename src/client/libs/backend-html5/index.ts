import type { BackendFactory, DragDropManager } from '../dnd-core'
import { HTML5BackendImpl } from './HTML5BackendImpl'
import type { HTML5BackendContext, HTML5BackendOptions } from './types'

export { getEmptyImage } from './getEmptyImage'
export * as NativeTypes from './NativeTypes'
export type { HTML5BackendContext, HTML5BackendOptions } from './types'

export const HTML5Backend: BackendFactory = function createBackend(
  manager: DragDropManager,
  context?: HTML5BackendContext,
  options?: HTML5BackendOptions,
): HTML5BackendImpl {
  return new HTML5BackendImpl(manager, context, options)
}
