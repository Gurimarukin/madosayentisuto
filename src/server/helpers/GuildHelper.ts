import type { Guild, GuildMember } from 'discord.js'
import { refinement } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { List, Maybe, NonEmptyArray, Tuple, refinementFromPredicate } from '../../shared/utils/fp'

import type { GuildAudioChannel } from '../utils/ChannelUtils'
import { ChannelUtils } from '../utils/ChannelUtils'

export const GuildHelper = {
  membersInPublicAudioChans: (
    guild: Guild,
  ): List<Tuple<GuildAudioChannel, NonEmptyArray<GuildMember>>> =>
    pipe(
      guild.channels.cache.toJSON(),
      List.filter(isPublicAudio),
      List.filterMap(channel =>
        pipe(
          channel.members.toJSON(),
          NonEmptyArray.fromReadonlyArray,
          Maybe.map(members => Tuple.of(channel, members)),
        ),
      ),
      // List.filter(member => DiscordUserId.fromUser(member.user) !== clientId), // don't count bot
    ),
}

const isPublicAudio = pipe(
  ChannelUtils.isGuildAudio,
  refinement.compose(refinementFromPredicate<GuildAudioChannel>(ChannelUtils.isPublic)),
)
