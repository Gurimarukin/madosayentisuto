import type React from 'react'

import { cssClasses } from '../utils/cssClasses'

type Props = {
  title: React.ReactNode
  className?: string
  children?: React.ReactNode
}

export const Tooltip: React.FC<Props> = ({ title, className, children }) => (
  <div className={cssClasses('relative group', className)}>
    {children}
    <div className="invisible absolute left-1/2 top-[calc(100%_+_2px)] z-50 opacity-0 blur duration-300 group-hover:visible group-hover:opacity-100 group-hover:blur-0">
      <div className="relative -left-1/2 flex rounded bg-gray1 px-3 py-2">{title}</div>
    </div>
  </div>
)
