import { useMemo } from 'react'

import type { Identifier } from '../../../dnd-core'
import { invariant } from '../../../util-invariant'
import type { DragSourceHookSpec } from '../types'

export function useDragType(spec: DragSourceHookSpec<any, any, any>): Identifier {
  return useMemo(() => {
    const result: Identifier = spec.type
    invariant(result != null, 'spec.type must be defined')
    return result
  }, [spec])
}
