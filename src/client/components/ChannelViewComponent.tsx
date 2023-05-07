import React from 'react'

import type { ChannelView } from '../../shared/models/ChannelView'
import type { GuildId } from '../../shared/models/guild/GuildId'
import { DiscordUtils } from '../../shared/utils/DiscordUtils'

type ChannelType = 'text' | 'audio'

type Props = {
  guild: GuildId
  channel: ChannelView
  type?: ChannelType
}

export const ChannelViewComponent = ({ guild, channel, type = 'text' }: Props): JSX.Element => (
  <a
    href={DiscordUtils.urls.guildChannel(guild, channel.id)}
    target="_blank"
    rel="noreferrer"
    className="cursor-pointer underline"
  >
    {((): string => {
      switch (type) {
        case 'text':
          return '#'
        case 'audio':
          return '📢'
      }
    })()}
    {channel.name}
  </a>
)
