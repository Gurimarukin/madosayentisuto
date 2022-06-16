import type { Action } from '../interfaces'
import { get } from '../utils/js_utils'
import type { State as DirtyHandlerIdsState } from './dirtyHandlerIds'
import { reduce as dirtyHandlerIds } from './dirtyHandlerIds'
import type { State as DragOffsetState } from './dragOffset'
import { reduce as dragOffset } from './dragOffset'
import type { State as DragOperationState } from './dragOperation'
import { reduce as dragOperation } from './dragOperation'
import type { State as RefCountState } from './refCount'
import { reduce as refCount } from './refCount'
import type { State as StateIdState } from './stateId'
import { reduce as stateId } from './stateId'

export interface State {
  dirtyHandlerIds: DirtyHandlerIdsState
  dragOffset: DragOffsetState
  refCount: RefCountState
  dragOperation: DragOperationState
  stateId: StateIdState
}

export function reduce(state: State = {} as State, action: Action<any>): State {
  return {
    dirtyHandlerIds: dirtyHandlerIds(state.dirtyHandlerIds, {
      type: action.type,
      payload: {
        ...action.payload,
        prevTargetIds: get<string[]>(state, 'dragOperation.targetIds', []),
      },
    }),
    dragOffset: dragOffset(state.dragOffset, action),
    refCount: refCount(state.refCount, action),
    dragOperation: dragOperation(state.dragOperation, action),
    stateId: stateId(state.stateId),
  }
}
