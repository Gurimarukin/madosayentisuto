/* eslint-disable functional/no-expression-statements */
import React, { useCallback } from 'react'

import { useHistory } from '../contexts/HistoryContext'

type Props = {
  to: string
  target?: string
  className?: string
  children?: React.ReactNode
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
