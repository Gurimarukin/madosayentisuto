import { Message, Role, TextChannel } from 'discord.js'

export type Calls = {
  readonly message: Message
  readonly channel: TextChannel
  readonly role: Role
}

export const Calls = {
  of: (message: Message, channel: TextChannel, role: Role): Calls => ({ message, channel, role }),
}
