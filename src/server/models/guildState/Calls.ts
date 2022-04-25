import type { Message, Role, TextChannel } from 'discord.js'

import { ChannelView } from '../../../shared/models/ChannelView'
import { MessageView } from '../../../shared/models/MessageView'
import type { CallsView } from '../../../shared/models/guild/CallsView'
import { RoleView } from '../../../shared/models/guild/RoleView'

export type Calls = {
  readonly message: Message
  readonly channel: TextChannel
  readonly role: Role
}

export const Calls = {
  toView: (c: Calls): CallsView => ({
    message: MessageView.fromMessage(c.message),
    channel: ChannelView.fromChannel(c.channel),
    role: RoleView.fromRole(c.role),
  }),
}
