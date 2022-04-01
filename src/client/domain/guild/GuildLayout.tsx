import { pipe } from 'fp-ts/function'
import React from 'react'
import type { SWRResponse } from 'swr'

import { apiRoutes } from '../../../shared/ApiRouter'
import type { GuildId } from '../../../shared/models/guild/GuildId'
import { GuildView } from '../../../shared/models/guild/GuildView'
import { Maybe } from '../../../shared/utils/fp'

import { Link } from '../../components/Link'
import { useHttp } from '../../hooks/useHttp'
import { appRoutes } from '../../router/AppRouter'
import { basicAsyncRenderer } from '../../utils/basicAsyncRenderer'

type Props = {
  readonly guildId: GuildId
  readonly selected: 'emojis' | 'members' | undefined
  readonly children?: (
    guild: GuildView,
    response: Omit<SWRResponse<GuildView, unknown>, 'data'>,
  ) => React.ReactNode
}

export const GuildLayout = ({ guildId, selected, children }: Props): JSX.Element => {
  const response = useHttp(apiRoutes.guild.get(guildId), {}, [GuildView.codec, 'GuildView'])
  const { data: guild, ...rest } = response

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center border-b border-gray1 shadow-lg pr-5 bg-gray2">
        <div className="grow flex items-center gap-x-4 p-2">
          {guild !== undefined ? (
            <>
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
              <Link to={appRoutes.guild.index(guildId)} className="text-3xl border-gray4">
                {guild.name}
              </Link>
              <span>•</span>
              <Link
                to={appRoutes.guild.members(guildId)}
                className={`text-xl border-b ${
                  selected === 'members' ? 'border-gray4' : 'border-transparent'
                } pt-2 pb-1`}
              >
                Membres
              </Link>
              <span>•</span>
              <Link
                to={appRoutes.guild.emojis(guildId)}
                className={`text-xl border-b ${
                  selected === 'emojis' ? 'border-gray4' : 'border-transparent'
                } pt-2 pb-1`}
              >
                Émojis
              </Link>
            </>
          ) : null}
        </div>
        <Link to={appRoutes.index} className="my-5">
          ↑  Retour à la liste des serveurs
        </Link>
      </div>
      <div className="grow flex justify-center">
        {basicAsyncRenderer(response)(g => children?.(g, rest))}
      </div>
    </div>
  )
}
