import React from 'react'

import type { ChannelView } from '../../shared/models/ChannelView'
import type { GuildId } from '../../shared/models/guild/GuildId'

import { DiscordUtils } from '../utils/DiscordUtils'

type Props = {
  readonly guild: GuildId
  readonly channel: ChannelView
}

export const ChannelViewComponent = ({ guild, channel }: Props): JSX.Element => (
  <a
    href={DiscordUtils.urls.guildChannel(guild, channel.id)}
    target="_blank"
    rel="noreferrer"
    className="cursor-pointer"
  >
    #{channel.name}
  </a>
)
