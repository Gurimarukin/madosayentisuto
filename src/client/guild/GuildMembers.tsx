import React from 'react'

import type { GuildId } from '../../shared/models/guild/GuildId'

import { GuildLayout } from './GuildLayout'

type Props = {
  readonly guildId: GuildId
}

export const GuildMembers = ({ guildId }: Props): JSX.Element => (
  <GuildLayout guildId={guildId} selected="members">
    {guild => <pre>{JSON.stringify(guild, null, 2)}</pre>}
  </GuildLayout>
)
