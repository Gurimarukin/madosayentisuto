/* eslint-disable functional/no-expression-statements */
import type React from 'react'
import { useCallback } from 'react'

import { useHistory } from '../contexts/HistoryContext'

type Props = {
  to: string
  target?: string
  className?: string
  children?: React.ReactNode
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
