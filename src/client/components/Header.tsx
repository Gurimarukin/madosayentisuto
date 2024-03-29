import type { ChildrenFC } from '../model/ChildrenFC'
import { appRoutes } from '../router/AppRouter'
import { Link } from './Link'

export const Header: ChildrenFC = ({ children }) => (
  <header className="flex items-center border-b border-gray1 bg-gray2 pr-5 shadow-lg">
    <div className="flex grow items-center gap-x-4 p-2">{children}</div>
    <Link to={appRoutes.index} className="py-4 text-2xl">
      Accueil
    </Link>
  </header>
)
