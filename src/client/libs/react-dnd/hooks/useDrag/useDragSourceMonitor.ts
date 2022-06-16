import { useMemo } from 'react'

import { DragSourceMonitorImpl } from '../../internals/index'
import type { DragSourceMonitor } from '../../types/index'
import { useDragDropManager } from '../useDragDropManager'

export function useDragSourceMonitor<O, R>(): DragSourceMonitor<O, R> {
  const manager = useDragDropManager()
  return useMemo<DragSourceMonitor<O, R>>(() => new DragSourceMonitorImpl(manager), [manager])
}
