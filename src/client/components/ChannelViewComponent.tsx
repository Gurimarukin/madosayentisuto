import { pipe } from 'fp-ts/function'
import type React from 'react'

import { ChannelId } from '../../shared/models/ChannelId'
import type { ChannelView } from '../../shared/models/ChannelView'
import type { GuildId } from '../../shared/models/guild/GuildId'
import { DiscordUtils } from '../../shared/utils/DiscordUtils'
import type { Dict } from '../../shared/utils/fp'
import { Maybe } from '../../shared/utils/fp'

type ChannelType = 'text' | 'audio'

type Props = {
  guild: GuildId
  channel: ChannelView
  /**
   * @ðefault 'text'
   */
  type?: ChannelType
}

export const ChannelViewComponent: React.FC<Props> = ({ guild, channel, type }) => (
  <a
    href={DiscordUtils.urls.guildChannel(guild, channel.id)}
    target="_blank"
    rel="noreferrer"
    className="cursor-pointer underline"
  >
    {channelLabel(channel, type)}
  </a>
)

export const channelLabel = (
  channel: ChannelView,
  type: ChannelType = 'text',
): React.JSX.Element | string =>
  pipe(
    channel.name,
    Maybe.foldW(
      () => (
        <pre className="inline">
          {'<'}
          {channelSymbol[type]}
          {ChannelId.unwrap(channel.id)}
          {'>'}
        </pre>
      ),
      name => `${channelSymbol[type]}${name}`,
    ),
  )

const channelSymbol: Dict<ChannelType, string> = {
  text: '#',
  audio: '📢',
}
