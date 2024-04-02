import { pipe } from 'fp-ts/function'
import type React from 'react'

import { apiRoutes } from '../../shared/ApiRouter'
import { DayJs } from '../../shared/models/DayJs'
import { ScheduledEventView } from '../../shared/models/ScheduledEventView'
import { DiscordUtils } from '../../shared/utils/DiscordUtils'
import { List, Maybe } from '../../shared/utils/fp'

import { ChannelViewComponent } from '../components/ChannelViewComponent'
import { Header } from '../components/Header'
import { RoleViewComponent } from '../components/RoleViewComponent'
import { Tooltip } from '../components/Tooltip'
import { useMySWR } from '../hooks/useMySWR'
import type { ChildrenFC } from '../model/ChildrenFC'
import { basicAsyncRenderer } from '../utils/basicAsyncRenderer'
import { cssClasses } from '../utils/cssClasses'

export const ScheduledEvents: React.FC = () => (
  <div className="flex h-full flex-col">
    <Header>
      <h1 className="text-2xl">Rappels</h1>
    </Header>
    <div className="flex grow justify-center overflow-auto">
      {basicAsyncRenderer(
        useMySWR(apiRoutes.scheduledEvents.get, {}, [
          List.decoder(ScheduledEventView.codec),
          'ScheduledEventView[]',
        ]),
      )(events => (
        <div className="grow overflow-auto">
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
      ))}
    </div>
  </div>
)

const renderEvent = (event: ScheduledEventView): React.JSX.Element => {
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
                  <div className="size-7 overflow-hidden rounded-full">
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
                              <div className="size-8 overflow-hidden rounded-md">
                                <img
                                  src={icon}
                                  alt={`Icone du serveur ${guild.name}`}
                                  className="size-full object-cover"
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

const formatScheduledAt = DayJs.format('DD/MM/YYYY, HH:mm', { locale: true })

const Th: ChildrenFC = ({ children }) => <th className="flex bg-gray2 px-5 py-3">{children}</th>

type TdProps = {
  className?: string
  children?: React.ReactNode
}

const Td: React.FC<TdProps> = ({ className, children }) => (
  <td className={cssClasses('flex items-center px-5 py-3 group-even:bg-gray2', className)}>
    {children}
  </td>
)
