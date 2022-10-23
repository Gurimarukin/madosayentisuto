import { string } from 'fp-ts'
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
  <div className="flex h-full flex-col overflow-auto">
    <div className="flex justify-center p-6">
      <h1 className="text-6xl">Bot Jean Plank</h1>
    </div>
    <div className="flex grow flex-col items-center p-4">
      {basicAsyncRenderer(useMySWR(apiRoutes.guilds.get, {}, [guildsDecoder, 'GuildViewShort[]']))(
        guilds => (
          <div className="flex flex-col gap-14 self-stretch">
            <Guilds guilds={guilds} />
            <div className="flex flex-col gap-3">
              <h2 className="text-3xl">Général</h2>
              <ul className="flex list-disc flex-col gap-3 pl-9 text-xl">
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
    <ul className="flex flex-wrap items-center gap-5">
      {guilds.map(guild => (
        <li key={GuildId.unwrap(guild.id)}>
          <Link
            to={appRoutes.guild.index(guild.id)}
            className="flex flex-col items-center gap-2 rounded-xl border-4 border-gray1 bg-gray2 p-5 pb-3 shadow-lg"
          >
            <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-lg bg-discordBlurple">
              {pipe(
                guild.icon,
                Maybe.fold(
                  () => <p className="text-5xl">{firstLetters(guild.name)}</p>,
                  icon => (
                    <img
                      src={icon}
                      alt={`Icone du serveur ${guild.name}`}
                      className="h-full w-full object-cover"
                    />
                  ),
                ),
              )}
            </div>
            <span>{guild.name}</span>
          </Link>
        </li>
      ))}
    </ul>
  </div>
)

const firstLetters = (str: string): string =>
  pipe(
    str,
    string.split(/\s+/),
    List.filterMap(word => Maybe.fromNullable(word[0])),
    List.mkString(''),
  )
