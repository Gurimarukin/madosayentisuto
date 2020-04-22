import { Message } from 'discord.js'

export namespace MessageUtils {
  export const isDm = (message: Message): boolean => message.channel.type === 'dm'
}
