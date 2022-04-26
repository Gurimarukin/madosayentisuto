/* eslint-disable functional/no-expression-statement */
import React, { useCallback } from 'react'

import { useHistory } from '../contexts/HistoryContext'

type Props = {
  readonly to: string
  readonly target?: string
  readonly className?: string
  readonly children?: React.ReactNode
}

export const Link = ({ to, target, className, children }: Props): JSX.Element => {
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
