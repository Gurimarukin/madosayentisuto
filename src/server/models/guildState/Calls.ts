import type { Role } from 'discord.js'

import type { CallsView } from '../../../shared/models/guild/CallsView'
import { RoleView } from '../../../shared/models/guild/RoleView'

import type { GuildSendableChannel } from '../../utils/ChannelUtils'
import { ChannelUtils } from '../../utils/ChannelUtils'

export type Calls = {
  readonly channel: GuildSendableChannel
  readonly role: Role
}

export const Calls = {
  toView: (c: Calls): CallsView => ({
    channel: ChannelUtils.toView(c.channel),
    role: RoleView.fromRole(c.role),
  }),
}
