import type { Message, Role } from 'discord.js'

type AutoroleMessage = {
  readonly message: Message<true>
  readonly role: Role
}

const AutoroleMessage = {}

export { AutoroleMessage }
