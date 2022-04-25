import React from 'react'

import { cssClasses } from '../utils/cssClasses'

type Props = {
  readonly title: React.ReactNode
  readonly className?: string
}

export const Tooltip: React.FC<Props> = ({ title, className, children }) => (
  <div className={cssClasses('relative group', className)}>
    {children}
    <div className="absolute left-1/2 top-[calc(100%_+_2px)] opacity-0 blur invisible duration-300 group-hover:opacity-100 group-hover:blur-0 group-hover:visible">
      <div className="relative left-[-50%] flex px-3 py-2 bg-gray1 rounded">{title}</div>
    </div>
  </div>
)
