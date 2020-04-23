import { Channel, DMChannel, TextChannel } from 'discord.js'

export namespace MessageUtils {
  export const isDm = (channel: Channel): channel is DMChannel => channel.type === 'dm'
  export const isText = (channel: Channel): channel is TextChannel => channel.type === 'dm'
}
