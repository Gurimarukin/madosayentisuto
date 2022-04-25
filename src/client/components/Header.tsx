import React from 'react'

import { appRoutes } from '../router/AppRouter'
import { Link } from './Link'

export const Header: React.FC = ({ children }) => (
  <header className="flex items-center border-b border-gray1 shadow-lg pr-5 bg-gray2">
    <div className="grow flex items-center gap-x-4 p-2">{children}</div>
    <Link to={appRoutes.index} className="text-2xl">
      Accueil
    </Link>
  </header>
)