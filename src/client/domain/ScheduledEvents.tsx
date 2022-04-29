import { pipe } from 'fp-ts/function'
import React from 'react'

import { apiRoutes } from '../../shared/ApiRouter'
import { DayJs } from '../../shared/models/DayJs'
import { ScheduledEventView } from '../../shared/models/ScheduledEventView'
import { List, Maybe } from '../../shared/utils/fp'

import { ChannelViewComponent } from '../components/ChannelViewComponent'
import { Header } from '../components/Header'
import { RoleViewComponent } from '../components/RoleViewComponent'
import { Tooltip } from '../components/Tooltip'
import { useMySWR } from '../hooks/useMySWR'
import { DiscordUtils } from '../utils/DiscordUtils'
import { basicAsyncRenderer } from '../utils/basicAsyncRenderer'
import { cssClasses } from '../utils/cssClasses'

export const ScheduledEvents = (): JSX.Element =>
  basicAsyncRenderer(
    useMySWR(apiRoutes.scheduledEvents.get, {}, [
      List.decoder(ScheduledEventView.codec),
      'ScheduledEventView[]',
    ]),
  )(events => (
    <div className="flex flex-col h-full">
      <Header>
        <h1 className="text-3xl">Rappels</h1>
      </Header>
      <div className="overflow-auto grow">
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
            {events.map((event, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <tr key={i} className="group contents">
                {renderEvent(event)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
                  <div className="overflow-hidden w-7 h-7 rounded-full">
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
                            <Tooltip
                              title={<span className="whitespace-nowrap">{guild.name}</span>}
                            >
                              <div className="overflow-hidden w-8 h-8 rounded-md">
                                <img
                                  src={icon}
                                  alt={`Icone du serveur ${guild.name}`}
                                  className="object-cover w-full h-full"
                                />
                              </div>
                            </Tooltip>
                          ),
                        ),
                      )}
                    </a>
                    <ChannelViewComponent guild={guild.id} channel={channel} />
                    <RoleViewComponent role={role} />
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

const Th: React.FC = ({ children }) => <th className="flex py-3 px-5 bg-gray2">{children}</th>

type TdProps = {
  readonly className?: string
}

const Td: React.FC<TdProps> = ({ className, children }) => (
  <td className={cssClasses('flex items-center px-5 py-3 group-even:bg-gray2', className)}>
    {children}
  </td>
)
