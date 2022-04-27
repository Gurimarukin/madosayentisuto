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
  <div className="flex overflow-auto flex-col h-full">
    <div className="flex justify-center p-6">
      <h1 className="text-6xl">Bot Jean Plank</h1>
    </div>
    <div className="flex flex-col grow items-center p-4">
      {basicAsyncRenderer(useMySWR(apiRoutes.guilds.get, {}, [guildsDecoder, 'GuildViewShort[]']))(
        guilds => (
          <div className="flex flex-col gap-14 self-stretch">
            <Guilds guilds={guilds} />
            <div className="flex flex-col gap-3">
              <h2 className="text-3xl">Général</h2>
              <ul className="flex flex-col gap-3 pl-9 text-xl list-disc">
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
    <ul className="flex flex-wrap gap-5 items-center">
      {guilds.map(guild => (
        <li key={GuildId.unwrap(guild.id)}>
          <Link
            to={appRoutes.guild.index(guild.id)}
            className="flex flex-col gap-2 items-center p-5 pb-3 bg-gray2 rounded-xl border-4 border-gray1 shadow-lg"
          >
            {pipe(
              guild.icon,
              Maybe.fold(
                () => null,
                icon => (
                  <div className="overflow-hidden w-32 h-32 rounded-lg">
                    <img
                      src={icon}
                      alt={`Icone du serveur ${guild.name}`}
                      className="object-cover w-full h-full"
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
