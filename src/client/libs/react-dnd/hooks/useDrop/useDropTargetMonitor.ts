import { useMemo } from 'react'

import { DropTargetMonitorImpl } from '../../internals/index'
import type { DropTargetMonitor } from '../../types/index'
import { useDragDropManager } from '../useDragDropManager'

export function useDropTargetMonitor<O, R>(): DropTargetMonitor<O, R> {
  const manager = useDragDropManager()
  return useMemo(() => new DropTargetMonitorImpl(manager), [manager])
}
