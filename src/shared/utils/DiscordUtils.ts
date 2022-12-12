import { ChannelId } from '../models/ChannelId'
import { GuildId } from '../models/guild/GuildId'

const url = (path: string): string => new URL(path, 'https://discord.com').toString()

export const DiscordUtils = {
  urls: {
    dmChannel: (channel: ChannelId): string => url(`/channels/@me/${ChannelId.unwrap(channel)}`),

    guild: (guild: GuildId): string => url(`/channels/${GuildId.unwrap(guild)}`),

    guildChannel: (guild: GuildId, channel: ChannelId): string =>
      url(`/channels/${GuildId.unwrap(guild)}/${ChannelId.unwrap(channel)}`),
  },
}
