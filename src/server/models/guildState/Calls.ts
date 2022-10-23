import type { Message, Role } from 'discord.js'

import { MessageView } from '../../../shared/models/MessageView'
import type { CallsView } from '../../../shared/models/guild/CallsView'
import { RoleView } from '../../../shared/models/guild/RoleView'

import type { GuildSendableChannel } from '../../utils/ChannelUtils'
import { ChannelUtils } from '../../utils/ChannelUtils'

export type Calls = {
  readonly message: Message<true>
  readonly channel: GuildSendableChannel
  readonly role: Role
}

export const Calls = {
  toView: (c: Calls): CallsView => ({
    message: MessageView.fromMessage(c.message),
    channel: ChannelUtils.toView(c.channel),
    role: RoleView.fromRole(c.role),
  }),
}
