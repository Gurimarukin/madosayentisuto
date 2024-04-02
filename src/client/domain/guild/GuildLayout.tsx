import { pipe } from 'fp-ts/function'
import type React from 'react'
import type { BareFetcher, SWRConfiguration, SWRResponse } from 'swr'

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
  guildId: GuildId
  selected: 'emojis' | 'members' | undefined
  options?: SWRConfiguration<GuildView, unknown, BareFetcher<GuildView>>
  children?: (guild: GuildView, response: GuildViewResponse) => React.ReactNode
}

export const GuildLayout: React.FC<Props> = ({ guildId, selected, options, children }) => {
  const response = useMySWR(
    apiRoutes.guild.get(guildId),
    {},
    [GuildView.codec, 'GuildView'],
    options,
  )

  const { data: guild, ...rest } = response

  return (
    <div className="flex size-full flex-col">
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
                    className="size-12 overflow-hidden rounded-lg mb-1"
                  >
                    <img src={icon} alt={`Icône du serveur ${guild.name}`} />
                  </Link>
                ),
              ),
            )}
            <Link to={appRoutes.guild.index(guildId)} className="border-gray4 text-2xl">
              {guild.name}
            </Link>
            <span>•</span>
            <Link
              to={appRoutes.guild.members(guildId)}
              className={`border-b text-xl ${
                selected === 'members' ? 'border-gray4' : 'border-transparent'
              } pb-1 pt-2`}
            >
              Membres
            </Link>
            <span>•</span>
            <Link
              to={appRoutes.guild.emojis(guildId)}
              className={`border-b text-xl ${
                selected === 'emojis' ? 'border-gray4' : 'border-transparent'
              } pb-1 pt-2`}
            >
              Émojis
            </Link>
          </>
        ) : null}
      </Header>
      <div className="flex grow justify-center overflow-auto">
        {basicAsyncRenderer(response)(g => children?.(g, rest))}
      </div>
    </div>
  )
}
