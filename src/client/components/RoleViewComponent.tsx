import React from 'react'

import type { RoleView } from '../../shared/models/guild/RoleView'

type Props = {
  role: RoleView
}

export const RoleViewComponent = ({ role }: Props): JSX.Element => (
  <span style={{ color: role.color }}>@{role.name}</span>
)
