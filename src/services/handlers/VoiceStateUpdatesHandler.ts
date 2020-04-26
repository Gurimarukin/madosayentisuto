import { GuildMember, VoiceChannel, Guild } from 'discord.js'

import { DiscordConnector } from '../DiscordConnector'
import { PartialLogger } from '../Logger'
import { ReferentialService } from '../ReferentialService'
import { TSnowflake } from '../../models/TSnowflake'
import { VoiceStateUpdate } from '../../models/VoiceStateUpdate'
import { ChannelUtils, SendableChannel } from '../../utils/ChannelUtils'
import { Future, Maybe, pipe, List } from '../../utils/fp'

export const VoiceStateUpdatesHandler = (
  Logger: PartialLogger,
  referentialService: ReferentialService,
  discord: DiscordConnector
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
    const toIgnore = referentialService.ignoredUsers(channel.guild)
    return pipe(
      logger.debug(
        `[${channel.guild.name}]`,
        `${user.displayName} joined the channel "${channel.name}"`
      ),
      Future.fromIOEither,
      Future.chain(_ => {
        const { ignored, others } = peopleInVocalChans(channel.guild, toIgnore)
        if (isIgnored(toIgnore)(user)) {
          return ignored.length + others.length === 1
            ? notifyIgnoredTriedToStartCall(user, channel)
            : Future.unit
        } else {
          return others.length === 1 ? notifyCallStarted(user, channel) : Future.unit
        }
      })
    )
  }

  function onMovedChannel(
    user: GuildMember,
    from: VoiceChannel,
    to: VoiceChannel
  ): Future<unknown> {
    return pipe(
      logger.debug(
        `[${from.guild.name}]`,
        `${user.displayName} moved from channel "${from.name}" to "${to.name}"`
      ),
      Future.fromIOEither
    )
  }

  function onLeftChannel(user: GuildMember, channel: VoiceChannel): Future<unknown> {
    const toIgnore = referentialService.ignoredUsers(channel.guild)
    return pipe(
      logger.debug(
        `[${channel.guild.name}]`,
        `${user.displayName} left the channel "${channel.name}"`
      ),
      Future.fromIOEither,
      Future.chain(_ => {
        const { ignored, others } = peopleInVocalChans(channel.guild, toIgnore)
        return ignored.length + others.length === 0
          ? pipe(
              logger.debug(`[${channel.guild.name}]`, `Call ended in "${channel.name}"`),
              Future.fromIOEither
            )
          : Future.unit
      })
    )
  }

  /**
   * Helpers
   */
  function notifyCallStarted(user: GuildMember, channel: VoiceChannel): Future<unknown> {
    return pipe(
      logger.debug(
        `[${channel.guild.name}]`,
        `Call started by ${user.displayName} in "${channel.name}"`
      ),
      Future.fromIOEither,
      Future.chain(_ =>
        notify(
          channel.guild,
          `Haha, ${user} appelle **#${channel.name}**... @everyone doit payer !`
        )
      )
    )
  }

  function notifyIgnoredTriedToStartCall(
    user: GuildMember,
    channel: VoiceChannel
  ): Future<unknown> {
    return pipe(
      logger.debug(
        `[${channel.guild.name}]`,
        `${user.displayName} started a call in "${channel.name}" (but he's ignored)`
      ),
      Future.fromIOEither,
      Future.chain(_ =>
        notify(
          channel.guild,
          `Haha, ${user} appelle **#${channel.name}**... Mais tout le monde s'en fout !`
        )
      )
    )
  }

  function notify(guild: Guild, message: string): Future<unknown> {
    return Future.parallel(
      pipe(
        referentialService.subscribedChannels(guild),
        List.map(id =>
          pipe(
            discord.fetchChannel(id),
            Future.chain(_ =>
              pipe(
                _,
                Maybe.filter(ChannelUtils.isSendable),
                Maybe.fold<SendableChannel, Future<unknown>>(
                  () =>
                    pipe(
                      logger.warn(`[${guild.name}]`, `Couldn't notify channel with id "${id}"`),
                      Future.fromIOEither
                    ),
                  _ => discord.sendMessage(_, message)
                )
              )
            )
          )
        )
      )
    )
  }
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

const peopleInVocalChans = (guild: Guild, toIgnore: TSnowflake[]): IgnoredAndOther =>
  pipe(
    guild.channels.cache.array(),
    List.filter(_ => _.type === 'voice'),
    List.reduce(IgnoredAndOther([], []), (acc, chan) =>
      pipe(
        chan.members.array(),
        List.partition(isIgnored(toIgnore)),
        ({ left: others, right: ignored }) =>
          IgnoredAndOther([...acc.ignored, ...ignored], [...acc.others, ...others])
      )
    )
  )

const isIgnored = (toIgnore: TSnowflake[]) => (user: GuildMember): boolean =>
  pipe(
    toIgnore,
    List.exists(_ => TSnowflake.unwrap(_) === user.id)
  )

interface IgnoredAndOther {
  readonly ignored: GuildMember[]
  readonly others: GuildMember[]
}
const IgnoredAndOther = (ignored: GuildMember[], others: GuildMember[]): IgnoredAndOther => ({
  ignored,
  others
})
