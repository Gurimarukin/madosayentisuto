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

type Props = {
  readonly guildId: GuildId
}

export const GuildDetail = ({ guildId }: Props): JSX.Element => {
  const response = useHttp(apiRoutes.get.api.guild(guildId), {}, [
    GuildDetailDAO.codec,
    'GuildDetailDAO',
  ])

  return (
    <div>
      <Link to={appRoutes.home}>retour</Link>
      {basicAsyncRenderer(response, guild => (
        <div>
          <h1>{guild.name}</h1>
          {pipe(
            guild.icon,
            Maybe.fold(
              () => null,
              icon => <img src={icon} alt={`Icone du serveur ${guild.name}`} />,
            ),
          )}
        </div>
      ))}
    </div>
  )
}
