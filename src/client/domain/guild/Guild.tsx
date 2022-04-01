import React from 'react'

import type { GuildId } from '../../../shared/models/guild/GuildId'

import { GuildLayout } from './GuildLayout'

type Props = {
  readonly guildId: GuildId
}
export const Guild = ({ guildId }: Props): JSX.Element => (
  <GuildLayout guildId={guildId} selected={undefined} />
)
