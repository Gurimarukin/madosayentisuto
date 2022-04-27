import { pipe } from 'fp-ts/function'
import React from 'react'

import { apiRoutes } from '../../shared/ApiRouter'
import { GuildId } from '../../shared/models/guild/GuildId'
import { GuildViewShort } from '../../shared/models/guild/GuildViewShort'
import { List, Maybe } from '../../shared/utils/fp'

import { Link } from '../components/Link'
import { useMySWR } from '../hooks/useMySWR'
import { appRoutes } from '../router/AppRouter'
import { basicAsyncRenderer } from '../utils/basicAsyncRenderer'

const guildsDecoder = List.decoder(GuildViewShort.codec)

export const Home = (): JSX.Element => (
  <div className="h-full flex flex-col">
    <div className="flex justify-center p-6">
      <h1 className="text-6xl">Bot Jean Plank</h1>
    </div>
    <div className="grow flex flex-col items-center p-4">
      {basicAsyncRenderer(useMySWR(apiRoutes.guilds.get, {}, [guildsDecoder, 'GuildViewShort[]']))(
        guilds => (
          <div className="self-stretch flex flex-col gap-14">
            <Guilds guilds={guilds} />
            <div className="flex flex-col gap-3">
              <h2 className="text-3xl">Général</h2>
              <ul className="flex flex-col pl-9 gap-3 list-disc text-xl">
                <li>
                  <Link to={appRoutes.scheduledEvents} className="underline">
                    Évènements
                  </Link>
                </li>
                <li>
                  <Link to={appRoutes.console} className="underline">
                    Console
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        ),
      )}
    </div>
  </div>
)

type GuildsProps = {
  readonly guilds: List<GuildViewShort>
}

const Guilds = ({ guilds }: GuildsProps): JSX.Element => (
  <div className="flex flex-col gap-3">
    <h2 className="text-3xl">Serveurs</h2>
    <ul className="flex items-center flex-wrap gap-5">
      {guilds.map(guild => (
        <li key={GuildId.unwrap(guild.id)}>
          <Link
            to={appRoutes.guild.index(guild.id)}
            className="flex flex-col items-center gap-2 border-4 border-gray1 rounded-xl shadow-lg p-5 pb-3 bg-gray2"
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
  </div>
)
