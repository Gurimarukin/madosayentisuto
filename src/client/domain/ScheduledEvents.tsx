import { pipe } from 'fp-ts/function'
import React from 'react'

import { apiRoutes } from '../../shared/ApiRouter'
import { DayJs } from '../../shared/models/DayJs'
import { ScheduledEventView } from '../../shared/models/ScheduledEventView'
import { List, Maybe } from '../../shared/utils/fp'

import { Header } from '../components/Header'
import { useHttp } from '../hooks/useHttp'
import { DiscordUtils } from '../utils/DiscordUtils'
import { basicAsyncRenderer } from '../utils/basicAsyncRenderer'
import { cssClasses } from '../utils/cssClasses'

export const ScheduledEvents = (): JSX.Element =>
  basicAsyncRenderer(
    useHttp(apiRoutes.scheduledEvents.get, {}, [
      List.decoder(ScheduledEventView.codec),
      'ScheduledEventView[]',
    ]),
  )(events => (
    <div>
      <Header>
        <h1 className="text-3xl">Rappels</h1>
      </Header>
      <table className="grid grid-cols-[auto_auto_auto_auto_1fr]">
        <thead className="contents">
          <tr className="contents text-lg font-bold">
            <Th>Date</Th>
            <Th>Auteur</Th>
            <Th>Qui</Th>
            <Th>Quoi</Th>
            <Th />
          </tr>
        </thead>
        <tbody className="contents">
          {events.map(event => (
            // eslint-disable-next-line react/jsx-key
            <tr className="contents group">{renderEvent(event)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  ))

const renderEvent = (event: ScheduledEventView): JSX.Element => {
  switch (event.type) {
    case 'Reminder':
      return (
        <>
          <Td>{formatScheduledAt(event.scheduledAt)}</Td>
          <Td className="gap-2">
            {pipe(
              event.createdBy.avatar,
              Maybe.fold(
                () => null,
                avatar => (
                  <div className="w-7 h-7 rounded-full overflow-hidden">
                    <img src={avatar} alt={`Avatar de ${event.createdBy.tag}`} />
                  </div>
                ),
              ),
            )}
            <span>{event.createdBy.tag}</span>
          </Td>
          <Td className="gap-2">
            {pipe(
              event.who,
              Maybe.foldW(
                () => 'MP',
                ({ guild, channel, role }) => (
                  <>
                    <a
                      href={DiscordUtils.urls.guild(guild.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="cursor-pointer"
                    >
                      {pipe(
                        guild.icon,
                        Maybe.fold(
                          () => <span>{guild.name}</span>,
                          icon => (
                            <div className="w-8 h-8 rounded-md overflow-hidden" title={guild.name}>
                              <img
                                src={icon}
                                alt={`Icone du serveur ${guild.name}`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ),
                        ),
                      )}
                    </a>
                    <a
                      href={DiscordUtils.urls.guildChannel(guild.id, channel.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="cursor-pointer"
                    >
                      #{channel.name}
                    </a>
                    <span style={{ color: role.color }}>@{role.name}</span>
                  </>
                ),
              ),
            )}
          </Td>
          <Td>{event.what}</Td>
          <Td />
        </>
      )

    case 'ItsFriday':
      return (
        <>
          <Td>{formatScheduledAt(event.scheduledAt)}</Td>
          <Td />
          <Td />
          <Td>C'est vendredi</Td>
          <Td />
        </>
      )
  }
}

const formatScheduledAt = DayJs.format('DD/MM/YYYY, HH:mm')

const Th: React.FC = ({ children }) => <th className="flex px-5 py-3 bg-gray2">{children}</th>

type TdProps = {
  readonly className?: string
}

const Td: React.FC<TdProps> = ({ className, children }) => (
  <td className={cssClasses('flex items-center px-5 py-3 group-even:bg-gray2', className)}>
    {children}
  </td>
)
