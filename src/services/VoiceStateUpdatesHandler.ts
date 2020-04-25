import { GuildMember, VoiceChannel, Guild } from 'discord.js'

import { DiscordConnector } from './DiscordConnector'
import { PartialLogger } from './Logger'
import { ReferentialService } from './ReferentialService'
import { VoiceStateUpdate } from '../models/VoiceStateUpdate'
import { ChannelUtils, SendableChannel } from '../utils/ChannelUtils'
import { Future, Maybe, pipe, List } from '../utils/fp'

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
    return pipe(
      logger.debug(
        `[${channel.guild.name}]`,
        `${user.displayName} joined the channel "${channel.name}"`
      ),
      Future.fromIOEither,
      Future.chain(_ =>
        peopleInVocalChans(channel.guild) === 1 ? notifyCallStarted(user, channel) : Future.unit
      )
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
    return pipe(
      logger.debug(
        `[${channel.guild.name}]`,
        `${user.displayName} left the channel "${channel.name}"`
      ),
      Future.fromIOEither,
      Future.chain(_ =>
        peopleInVocalChans(channel.guild) === 0
          ? pipe(
              logger.debug(`[${channel.guild.name}]`, `Call ended in "${channel.name}"`),
              Future.fromIOEither
            )
          : Future.unit
      )
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
        Future.parallel(
          pipe(
            referentialService.channelsToSpamOnCall(channel.guild, user),
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
                          logger.warn(
                            `Couldn't notify channel with id "${id}" of a call in server "${channel.guild}"`
                          ),
                          Future.fromIOEither
                        ),
                      _ =>
                        discord.sendMessage(
                          _,
                          'Haha, un appel a commencé... @everyone doit payer !'
                        )
                    )
                  )
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

const peopleInVocalChans = (guild: Guild): number =>
  pipe(
    guild.channels.cache.array(),
    List.filter(_ => _.type === 'voice'),
    List.reduce(0, (acc, chan) => acc + chan.members.size)
  )
