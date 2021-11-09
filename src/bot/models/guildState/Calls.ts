import type { Message, Role, TextChannel } from 'discord.js'

export type Calls = {
  readonly message: Message
  readonly channel: TextChannel
  readonly role: Role
}
