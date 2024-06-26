import type { ChildrenFC } from '../model/ChildrenFC'
import { appRoutes } from '../router/AppRouter'
import { Link } from './Link'

export const Header: ChildrenFC = ({ children }) => (
  <header className="flex items-center gap-x-4 border-b border-gray1 bg-gray2 px-5 shadow-lg">
    <Link to={appRoutes.index} className="py-4 text-3xl">
      Accueil
    </Link>
    {children !== null && children !== undefined ? (
      <>
        <span>•</span>
        <div className="mt-1 flex items-center gap-x-4">{children}</div>
      </>
    ) : null}
  </header>
)
