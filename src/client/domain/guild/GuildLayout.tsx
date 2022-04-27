import { pipe } from 'fp-ts/function'
import React from 'react'
import type { SWRResponse } from 'swr'

import { apiRoutes } from '../../../shared/ApiRouter'
import type { GuildId } from '../../../shared/models/guild/GuildId'
import { GuildView } from '../../../shared/models/guild/GuildView'
import { Maybe } from '../../../shared/utils/fp'

import { Header } from '../../components/Header'
import { Link } from '../../components/Link'
import { useMySWR } from '../../hooks/useMySWR'
import { appRoutes } from '../../router/AppRouter'
import { basicAsyncRenderer } from '../../utils/basicAsyncRenderer'

export type GuildViewResponse = Omit<SWRResponse<GuildView, unknown>, 'data'>

type Props = {
  readonly guildId: GuildId
  readonly selected: 'emojis' | 'members' | undefined
  readonly children?: (guild: GuildView, response: GuildViewResponse) => React.ReactNode
}

export const GuildLayout = ({ guildId, selected, children }: Props): JSX.Element => {
  const response = useMySWR(apiRoutes.guild.get(guildId), {}, [GuildView.codec, 'GuildView'])
  const { data: guild, ...rest } = response

  return (
    <div className="w-full h-full flex flex-col">
      <Header>
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
      </Header>
      <div className="grow flex justify-center overflow-auto">
        {basicAsyncRenderer(response)(g => children?.(g, rest))}
      </div>
    </div>
  )
}
