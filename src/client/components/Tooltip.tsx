import React from 'react'

import { cssClasses } from '../utils/cssClasses'

type Props = {
  readonly title: React.ReactNode
  readonly className?: string
}

export const Tooltip: React.FC<Props> = ({ title, className, children }) => (
  <div className={cssClasses('relative group', className)}>
    {children}
    <div className="absolute top-[calc(100%_+_2px)] left-1/2 invisible group-hover:visible z-50 opacity-0 group-hover:opacity-100 blur group-hover:blur-0 duration-300">
      <div className="flex relative left-[-50%] py-2 px-3 bg-gray1 rounded">{title}</div>
    </div>
  </div>
)
