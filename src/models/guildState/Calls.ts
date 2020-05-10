import { Message, Channel, Role } from 'discord.js'

export interface Calls {
  readonly message: Message
  readonly channel: Channel
  readonly role: Role
}

export function Calls(message: Message, channel: Channel, role: Role): Calls {
  return { message, channel, role }
}
