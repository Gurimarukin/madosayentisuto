import type React from 'react'

import type { RoleView } from '../../shared/models/guild/RoleView'

type Props = {
  role: RoleView
}

export const RoleViewComponent: React.FC<Props> = ({ role }) => (
  <span style={{ color: role.color }}>@{role.name}</span>
)
