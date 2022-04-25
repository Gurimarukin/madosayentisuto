/* eslint-disable functional/no-expression-statement */
import { Route, parse, zero } from 'fp-ts-routing'
import { pipe } from 'fp-ts/function'
import React, { useEffect, useMemo } from 'react'

import { Maybe } from '../../shared/utils/fp'
import { Tuple } from '../../shared/utils/fp'

import { Link } from '../components/Link'
import { Home } from '../domain/Home'
import { Login } from '../domain/Login'
import { ScheduledEvents } from '../domain/ScheduledEvents'
import { Guild } from '../domain/guild/Guild'
import { GuildEmojis } from '../domain/guild/GuildEmojis'
import { GuildMembers } from '../domain/guild/GuildMembers'
import { appParsers, appRoutes } from './AppRouter'
import { useHistory } from './HistoryContext'

type ElementWithTitle = Tuple<JSX.Element, Maybe<string>>

const t = (element: JSX.Element, title?: string): ElementWithTitle =>
  Tuple.of(element, Maybe.fromNullable(title))

const titleWithElementParser = zero<ElementWithTitle>()
  .alt(appParsers.index.map(() => t(<Home />)))
  .alt(appParsers.login.map(() => t(<Login />, 'Connexion')))
  .alt(appParsers.guild.index.map(({ guildId }) => t(<Guild guildId={guildId} />, 'Serveur')))
  .alt(
    appParsers.guild.members.map(({ guildId }) =>
      t(<GuildMembers guildId={guildId} />, 'Serveur - membres'),
    ),
  )
  .alt(
    appParsers.guild.emojis.map(({ guildId }) =>
      t(<GuildEmojis guildId={guildId} />, 'Serveur - émojis'),
    ),
  )
  .alt(appParsers.scheduledEvents.map(() => t(<ScheduledEvents />, 'Évènements')))

export const AppRouterComponent = (): JSX.Element => {
  const { location } = useHistory()

  const [node, title] = useMemo(() => {
    const [node_, subTitle] = parse(
      titleWithElementParser,
      Route.parse(location.pathname),
      t(<NotFound />, 'Page non trouvée'),
    )
    const title_ = `Bot Jean Plank${pipe(
      subTitle,
      Maybe.fold(
        () => '',
        s => ` | ${s}`,
      ),
    )}`
    return [node_, title_]
  }, [location.pathname])

  useEffect(() => {
    // eslint-disable-next-line functional/immutable-data
    document.title = title
  }, [title])

  return node
}

// TODO: move to own file?
const NotFound = (): JSX.Element => (
  <div className="flex flex-col items-center p-6 gap-4">
    <p className="text-xl">Cette page n'existe pas.</p>
    <Link to={appRoutes.index} className="underline">
      Accueil
    </Link>
  </div>
)
