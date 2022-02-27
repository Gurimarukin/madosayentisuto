/* eslint-disable functional/no-expression-statement */
import React, { useCallback } from 'react'

import { useHistory } from '../router/HistoryContext'

type Props = {
  readonly to: string
  readonly target?: string
  readonly className?: string
}

export const Link: React.FC<Props> = ({ to, target, className, children }) => {
  const { navigate } = useHistory()

  const onClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      navigate(to)
    },
    [navigate, to],
  )

  return (
    <a href={to} onClick={onClick} target={target} className={className}>
      {children}
    </a>
  )
}
