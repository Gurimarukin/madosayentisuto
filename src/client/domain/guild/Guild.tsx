import { pipe } from 'fp-ts/function'
import React, { useEffect } from 'react'
import type { KeyedMutator } from 'swr'

import { ServerToClientEvent } from '../../../shared/models/event/ServerToClientEvent'
import type { GuildId } from '../../../shared/models/guild/GuildId'
import type { GuildView } from '../../../shared/models/guild/GuildView'
import { TObservable } from '../../../shared/models/rx/TObservable'
import { Future, IO, Maybe, toNotUsed } from '../../../shared/utils/fp'

import { AudioState } from '../../components/AudioState'
import { ChannelViewComponent } from '../../components/ChannelViewComponent'
import { RoleViewComponent } from '../../components/RoleViewComponent'
import { useServerClientWS } from '../../contexts/ServerClientWSContext'
import { cssClasses } from '../../utils/cssClasses'
import { getOnError } from '../../utils/getOnError'
import { GuildLayout } from './GuildLayout'

type Props = {
  readonly guildId: GuildId
}
export const Guild = ({ guildId }: Props): JSX.Element => (
  <GuildLayout guildId={guildId} selected={undefined}>
    {(guild, { mutate }) => <GuildComponent guild={guild} mutate={mutate} />}
  </GuildLayout>
)

type GuildComponentProps = {
  readonly guild: GuildView
  readonly mutate: KeyedMutator<GuildView>
}

const GuildComponent = ({ guild, mutate }: GuildComponentProps): JSX.Element => {
  const { serverToClientEventObservable } = useServerClientWS()

  useEffect(() => {
    const subscription = pipe(
      serverToClientEventObservable,
      TObservable.filter(ServerToClientEvent.isGuildStateUpdated),
      TObservable.subscribe(getOnError)({
        next: () =>
          pipe(
            Future.tryCatch(() => mutate()),
            Future.map(toNotUsed),
          ),
      }),
      IO.runUnsafe,
    )
    return () => subscription.unsubscribe()
  }, [mutate, serverToClientEventObservable])

  return (
    <div className="h-full w-full overflow-auto px-8 pt-4 pb-12">
      <ul className="flex list-disc flex-col gap-6">
        <Li label="calls" className="flex-col gap-0">
          {pipe(
            guild.state.calls,
            Maybe.map(({ channel, role }) => (
              // eslint-disable-next-line react/jsx-key
              <ul className="flex list-disc flex-col gap-1 py-2 pl-8">
                <LiPre label="channel:">
                  <ChannelViewComponent guild={guild.id} channel={channel} />
                </LiPre>
                <LiPre label="role:">
                  <RoleViewComponent role={role} />
                </LiPre>
              </ul>
            )),
          )}
        </Li>
        <Li label="defaultRole" className="gap-4">
          {pipe(
            guild.state.defaultRole,
            // eslint-disable-next-line react/jsx-key
            Maybe.map(role => <RoleViewComponent role={role} />),
          )}
        </Li>
        <Li label="itsFridayChannel" className="gap-4">
          {pipe(
            guild.state.itsFridayChannel,
            // eslint-disable-next-line react/jsx-key
            Maybe.map(channel => <ChannelViewComponent guild={guild.id} channel={channel} />),
          )}
        </Li>
        <Li label="birthdayChannel" className="gap-4">
          {pipe(
            guild.state.birthdayChannel,
            // eslint-disable-next-line react/jsx-key
            Maybe.map(channel => <ChannelViewComponent guild={guild.id} channel={channel} />),
          )}
        </Li>
        <Li label="audioState" className="flex-col gap-2">
          {pipe(
            guild.state.audioState,
            // eslint-disable-next-line react/jsx-key
            Maybe.map(state => <AudioState guild={guild.id} state={state} />),
          )}
        </Li>
      </ul>
    </div>
  )
}

type LiProps = {
  readonly label: string
  readonly className?: string
  readonly children: Maybe<React.ReactNode>
}

const Li = ({ label, className, children }: LiProps): JSX.Element =>
  pipe(
    children,
    Maybe.fold(
      () => <LiPre label={`${label}: null`} className={className} />,
      c => (
        <LiPre label={`${label}:`} className={className}>
          {c}
        </LiPre>
      ),
    ),
  )

type LiPreProps = {
  readonly label: string
  readonly className?: string
}

const LiPre: React.FC<LiPreProps> = ({ label, className, children }) => (
  <li>
    <div className={cssClasses('flex', className)}>
      <pre className="text-sm">{label}</pre>
      {children}
    </div>
  </li>
)
