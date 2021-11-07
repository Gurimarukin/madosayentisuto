import { Message, Role, TextChannel } from 'discord.js'

export type Calls = {
  readonly message: Message // TODO: remove (useless)
  readonly channel: TextChannel
  readonly role: Role
}
