import { GuildMember, VoiceChannel } from 'discord.js'

import { DiscordConnector } from '../DiscordConnector'
import { PartialLogger } from '../Logger'
import { GuildStateService } from '../GuildStateService'
import { VoiceStateUpdate } from '../../models/VoiceStateUpdate'
import { Future, Maybe, pipe } from '../../utils/fp'
import { LogUtils } from '../../utils/LogUtils'

export const VoiceStateUpdatesHandler = (
  Logger: PartialLogger,
  _guildStateService: GuildStateService,
  _discord: DiscordConnector
): ((voiceStateUpdate: VoiceStateUpdate) => Future<unknown>) => {
  const logger = Logger('VoiceStateUpdatesHandler')

  return voiceStateUpdate =>
    pipe(
      getUser(voiceStateUpdate),
      Maybe.map(user => {
        const oldChan = Maybe.fromNullable(voiceStateUpdate.oldState.channel)
        const newChan = Maybe.fromNullable(voiceStateUpdate.newState.channel)

        return Maybe.isNone(oldChan) && Maybe.isSome(newChan)
          ? onJoinedChannel(user, newChan.value)
          : Maybe.isSome(oldChan) && Maybe.isSome(newChan) && oldChan.value.id !== newChan.value.id
          ? onMovedChannel(user, oldChan.value, newChan.value)
          : Maybe.isSome(oldChan) && Maybe.isNone(newChan)
          ? onLeftChannel(user, oldChan.value)
          : Future.unit
      }),
      Maybe.getOrElse<Future<unknown>>(() => Future.unit)
    )

  /**
   * Event handlers
   */
  function onJoinedChannel(user: GuildMember, channel: VoiceChannel): Future<unknown> {
    return pipe(
      LogUtils.withGuild(
        logger,
        'debug',
        channel.guild
      )(`${user.displayName} joined the channel "${channel.name}"`),
      Future.fromIOEither
    )
  }

  function onMovedChannel(
    user: GuildMember,
    from: VoiceChannel,
    to: VoiceChannel
  ): Future<unknown> {
    return pipe(
      LogUtils.withGuild(
        logger,
        'debug',
        from.guild
      )(`${user.displayName} moved from channel "${from.name}" to "${to.name}"`),
      Future.fromIOEither
    )
  }

  function onLeftChannel(user: GuildMember, channel: VoiceChannel): Future<unknown> {
    return pipe(
      LogUtils.withGuild(
        logger,
        'debug',
        channel.guild
      )(`${user.displayName} left the channel "${channel.name}"`),
      Future.fromIOEither
    )
  }

  /**
   * Helpers
   */
  // function notifySubscribedChannels(guild: Guild, message: string): Future<unknown> {
  //   return pipe(
  //     referentialService.subscribedChannels(guild),
  //     List.map(id =>
  //       pipe(
  //         discord.fetchChannel(id),
  //         Future.chain(_ =>
  //           pipe(
  //             _,
  //             Maybe.filter(ChannelUtils.isSendable),
  //             Maybe.fold<SendableChannel, Future<unknown>>(
  //               () =>
  //                 pipe(
  //                   logger.warn(`[${guild.name}]`, `Couldn't notify channel with id "${id}"`),
  //                   Future.fromIOEither
  //                 ),
  //               _ => discord.sendMessage(_, message)
  //             )
  //           )
  //         )
  //       )
  //     ),
  //     Future.parallel
  //   )
  // }

  // function notifyDmCallStarted(
  //   calledBy: GuildMember,
  //   channel: GuildChannel,
  //   users: GuildMember[]
  // ): Future<unknown> {
  //   return pipe(
  //     discord.createInvite(channel),
  //     Future.chain(invite =>
  //       pipe(
  //         users,
  //         List.map(user =>
  //           pipe(
  //             discord.sendMessage(
  //               user,
  //               StringUtils.stripMargins(
  //                 `Haha, ${calledBy} appelle **${channel.name}**. Tout le monde doit payer !
  //               |${invite.url}`
  //               )
  //             ),
  //             Future.chain(
  //               Maybe.fold(
  //                 () => Future.fromIOEither(logger.warn(`Couldn't DM notify: ${user.user.tag}`)),
  //                 _ => Future.unit
  //               )
  //             )
  //           )
  //         ),
  //         Future.parallel
  //       )
  //     )
  //   )
  // }
}

// ensures that we have the same id
const getUser = (voiceStateUpdate: VoiceStateUpdate): Maybe<GuildMember> =>
  pipe(
    Maybe.fromNullable(voiceStateUpdate.oldState.member),
    Maybe.chain(u =>
      pipe(
        Maybe.fromNullable(voiceStateUpdate.newState.member),
        Maybe.filter(_ => _.id === u.id)
      )
    )
  )

// const peopleInPublicVocalChans = (guild: Guild, toIgnore: TSnowflake[]): IgnoredAndOther =>
//   pipe(
//     guild.channels.cache.array(),
//     List.filter(_ => ChannelUtils.isPublic(_) && _.type === 'voice'),
//     List.reduce(IgnoredAndOther([], []), (acc, chan) =>
//       pipe(
//         chan.members.array(),
//         List.partition(isIgnored(toIgnore)),
//         ({ left: others, right: ignored }) =>
//           IgnoredAndOther([...acc.ignored, ...ignored], [...acc.others, ...others])
//       )
//     )
//   )

// const isIgnored = (toIgnore: TSnowflake[]) => (user: GuildMember): boolean =>
//   pipe(
//     toIgnore,
//     List.exists(_ => TSnowflake.unwrap(_) === user.id)
//   )

interface IgnoredAndOther {
  readonly ignored: GuildMember[]
  readonly others: GuildMember[]
}
const IgnoredAndOther = (ignored: GuildMember[], others: GuildMember[]): IgnoredAndOther => ({
  ignored,
  others
})
