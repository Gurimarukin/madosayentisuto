import type { Role } from 'discord.js'
import { eq } from 'fp-ts'

import type { CallsView } from '../../../shared/models/guild/CallsView'
import { RoleView } from '../../../shared/models/guild/RoleView'

import type { GuildSendableChannel } from '../../utils/ChannelUtils'
import { ChannelUtils } from '../../utils/ChannelUtils'
import { RoleUtils } from '../../utils/RoleUtils'

type Calls = {
  readonly channel: GuildSendableChannel
  readonly role: Role
}

const toView = (c: Calls): CallsView => ({
  channel: ChannelUtils.toView(c.channel),
  role: RoleView.fromRole(c.role),
})

const Eq: eq.Eq<Calls> = eq.struct({
  channel: ChannelUtils.EqById,
  role: RoleUtils.EqById,
})

const Calls = { toView, Eq }

export { Calls }
