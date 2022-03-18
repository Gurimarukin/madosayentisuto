import { pipe } from 'fp-ts/function'
import React from 'react'

import { apiRoutes } from '../shared/ApiRouter'
import { GuildId } from '../shared/models/guild/GuildId'
import { GuildShortDAO } from '../shared/models/guild/GuildShortDAO'
import { List, Maybe } from '../shared/utils/fp'

import { Link } from './components/Link'
import { useHttp } from './hooks/useHttp'
import { appRoutes } from './router/AppRouter'

const guildsDecoder = List.decoder(GuildShortDAO.codec)

export const Guilds = (): JSX.Element => {
  const { data: guilds, error } = useHttp(apiRoutes.get.api.guilds, {}, [
    guildsDecoder,
    'GuildShortDAO[]',
  ])

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-center p-6">
        <h1 className="text-6xl">Jean Plank Bot</h1>
      </div>
      <div className="grow flex justify-center items-center flex-wrap">
        {error !== undefined ? (
          <pre>error</pre>
        ) : guilds === undefined ? (
          <pre>loading...</pre>
        ) : (
          <ul>
            {guilds.map(guild => (
              <li key={GuildId.unwrap(guild.id)}>
                <Link
                  to={appRoutes.guild.index(guild.id)}
                  className="flex flex-col items-center gap-y-2 border-4 border-gray1 rounded-xl shadow-lg p-5 pb-3 bg-gray2"
                >
                  {pipe(
                    guild.icon,
                    Maybe.fold(
                      () => null,
                      icon => (
                        <div className="w-32 h-32 rounded-lg overflow-hidden">
                          <img
                            src={icon}
                            alt={`Icone du serveur ${guild.name}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ),
                    ),
                  )}
                  <span>{guild.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
