import type { DragPreviewOptions, DragSourceOptions } from './options'

export type ConnectableElement = React.RefObject<any> | React.ReactElement | Element | null

export type DragElementWrapper<Options> = (
  elementOrNode: ConnectableElement,
  options?: Options,
) => React.ReactElement | null

export type ConnectDragSource = DragElementWrapper<DragSourceOptions>
export type ConnectDropTarget = DragElementWrapper<any>
export type ConnectDragPreview = DragElementWrapper<DragPreviewOptions>
