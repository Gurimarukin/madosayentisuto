import type { Role } from 'discord.js'
import { eq } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import type { CallsView } from '../../../shared/models/guild/CallsView'
import { RoleView } from '../../../shared/models/guild/RoleView'
import { List, Maybe } from '../../../shared/utils/fp'

import type { GuildAudioChannel, GuildSendableChannel } from '../../utils/ChannelUtils'
import { ChannelUtils } from '../../utils/ChannelUtils'
import { RoleUtils } from '../../utils/RoleUtils'

type Calls = {
  channel: GuildSendableChannel
  role: Role
  whitelistedChannels: Maybe<List<GuildAudioChannel>> // None allows all channels
}

const toView = (c: Calls): CallsView => ({
  channel: ChannelUtils.toView(c.channel),
  role: RoleView.fromRole(c.role),
  whitelistedChannels: pipe(c.whitelistedChannels, Maybe.map(List.map(ChannelUtils.toView))),
})

const Eq: eq.Eq<Calls> = eq.struct({
  channel: ChannelUtils.Eq.byId,
  role: RoleUtils.Eq.byId,
  whitelistedChannels: Maybe.getEq(List.getEq(ChannelUtils.Eq.byId)),
})

const Calls = { toView, Eq }

export { Calls }
