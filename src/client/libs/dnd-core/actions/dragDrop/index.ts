import type { DragDropActions, DragDropManager } from '../../interfaces'
import { createBeginDrag } from './beginDrag'
import { createDrop } from './drop'
import { createEndDrag } from './endDrag'
import { createHover } from './hover'
import { createPublishDragSource } from './publishDragSource'

export * from './types'

export function createDragDropActions(manager: DragDropManager): DragDropActions {
  return {
    beginDrag: createBeginDrag(manager),
    publishDragSource: createPublishDragSource(manager),
    hover: createHover(manager),
    drop: createDrop(manager),
    endDrag: createEndDrag(manager),
  }
}
