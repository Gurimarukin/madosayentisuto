import { pipe } from 'fp-ts/function'
import React from 'react'

import { apiRoutes } from '../../shared/ApiRouter'
import { GuildDetailDAO } from '../../shared/models/guild/GuildDetailDAO'
import type { GuildId } from '../../shared/models/guild/GuildId'
import { Maybe } from '../../shared/utils/fp'

import { Link } from '../components/Link'
import { useHttp } from '../hooks/useHttp'
import { appRoutes } from '../router/AppRouter'
import { basicAsyncRenderer } from '../utils/basicAsyncRenderer'
import { cssClasses } from '../utils/cssClasses'

type Props = {
  readonly guildId: GuildId
  readonly selected: 'emojis' | undefined
  readonly children?: (guild: GuildDetailDAO) => React.ReactNode
}

export const GuildLayout = ({ guildId, selected, children }: Props): JSX.Element => {
  const response = useHttp(apiRoutes.get.api.guild(guildId), {}, [
    GuildDetailDAO.codec,
    'GuildDetailDAO',
  ])

  return (
    <div className="w-full h-full flex flex-col">
      <div className="grow flex flex-col">
        {basicAsyncRenderer(response)(guild => (
          <>
            <div className="flex items-center border-b border-gray1 shadow-lg bg-gray2">
              <div className="p-3">
                <Link to={appRoutes.index}>← Retour à la liste des serveurs</Link>
              </div>
              <div className="grow flex justify-center items-center gap-x-4 p-2">
                {pipe(
                  guild.icon,
                  Maybe.fold(
                    () => null,
                    icon => (
                      <Link
                        to={appRoutes.guild.index(guildId)}
                        className="w-12 h-12 rounded-lg overflow-hidden"
                      >
                        <img src={icon} alt={`Icône du serveur ${guild.name}`} />
                      </Link>
                    ),
                  ),
                )}
                <Link
                  to={appRoutes.guild.index(guildId)}
                  className={cssClasses('text-3xl border-gray4', [
                    'border-b',
                    selected === undefined,
                  ])}
                >
                  {guild.name}
                </Link>
                <span>•</span>
                <Link
                  to={appRoutes.guild.emojis(guildId)}
                  className={cssClasses('text-xl border-gray4 pt-2 pb-1', [
                    'border-b',
                    selected === 'emojis',
                  ])}
                >
                  Émojis
                </Link>
              </div>
            </div>
            <div className="grow">{children?.(guild)}</div>
          </>
        ))}
      </div>
    </div>
  )
}
