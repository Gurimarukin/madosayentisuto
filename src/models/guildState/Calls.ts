import { Message, Role, TextChannel } from 'discord.js'

export type Calls = {
  readonly message: Message
  readonly channel: TextChannel
  readonly role: Role
}

export function Calls(message: Message, channel: TextChannel, role: Role): Calls {
  return { message, channel, role }
}
