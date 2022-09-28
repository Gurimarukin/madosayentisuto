import type { Guild, GuildMember } from 'discord.js'
import { refinement } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { List, refinementFromPredicate } from '../../shared/utils/fp'

import { ChannelUtils } from '../utils/ChannelUtils'

export const GuildHelper = {
  membersInPublicAudioChans: (guild: Guild): List<GuildMember> =>
    pipe(
      guild.channels.cache.toJSON(),
      List.filter(isPublicAudio),
      List.chain(channel => channel.members.toJSON()),
      // List.filter(member => DiscordUserId.fromUser(member.user) !== clientId), // don't count bot
    ),
}

const isPublicAudio = pipe(
  ChannelUtils.isGuildAudio,
  refinement.compose(refinementFromPredicate(ChannelUtils.isPublic)),
)
