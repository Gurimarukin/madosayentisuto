import React from 'react'

import { cssClasses } from '../utils/cssClasses'

type Props = {
  title: React.ReactNode
  className?: string
}

export const Tooltip: React.FC<Props> = ({ title, className, children }) => (
  <div className={cssClasses('relative group', className)}>
    {children}
    <div className="invisible absolute top-[calc(100%_+_2px)] left-1/2 z-50 opacity-0 blur duration-300 group-hover:visible group-hover:opacity-100 group-hover:blur-0">
      <div className="relative left-[-50%] flex rounded bg-gray1 py-2 px-3">{title}</div>
    </div>
  </div>
)
