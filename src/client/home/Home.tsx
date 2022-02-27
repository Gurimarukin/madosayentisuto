import { pipe } from 'fp-ts/function'
import React from 'react'

import { apiRoutes } from '../../shared/ApiRouter'
import { GuildId } from '../../shared/models/guild/GuildId'
import { GuildShortDAO } from '../../shared/models/guild/GuildShortDAO'
import { List, Maybe } from '../../shared/utils/fp'

import { Link } from '../components/Link'
import { useHttp } from '../hooks/useHttp'
import { appRoutes } from '../router/AppRouter'

const guildsDecoder = List.decoder(GuildShortDAO.codec)

export const Home = (): JSX.Element => {
  const { data: guilds, error } = useHttp(apiRoutes.get.api.guilds, {}, [
    guildsDecoder,
    'GuildShortDAO[]',
  ])

  return (
    <>
      <Link to={appRoutes.home}>
        <h1>Jean Plank Bot</h1>
      </Link>
      {error !== undefined ? (
        <pre>error</pre>
      ) : guilds === undefined ? (
        <pre>loading...</pre>
      ) : (
        <ul>
          {guilds.map(guild => (
            <li key={GuildId.unwrap(guild.id)}>
              <Link to={appRoutes.guild(guild.id)}>
                {pipe(
                  guild.icon,
                  Maybe.fold(
                    () => <span>?</span>,
                    icon => <img src={icon} alt={`Icone du serveur ${guild.name}`} />,
                  ),
                )}
                <span>{guild.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
