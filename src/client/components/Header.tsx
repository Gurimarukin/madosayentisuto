import React from 'react'

import { appRoutes } from '../router/AppRouter'
import { Link } from './Link'

export const Header: React.FC = ({ children }) => (
  <header className="flex items-center pr-5 bg-gray2 border-b border-gray1 shadow-lg">
    <div className="flex grow gap-x-4 items-center p-2">{children}</div>
    <Link to={appRoutes.index} className="text-2xl">
      Accueil
    </Link>
  </header>
)
