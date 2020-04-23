import { GuildMember, VoiceChannel } from 'discord.js'

import { PartialLogger } from './Logger'
import { VoiceStateUpdate } from '../models/VoiceStateUpdate'
import { Future, Maybe, pipe } from '../utils/fp'

export const VoiceStateUpdatesHandler = (
  Logger: PartialLogger
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

  function onJoinedChannel(user: GuildMember, channel: VoiceChannel): Future<unknown> {
    return pipe(
      logger.debug(
        `[${channel.guild.name}]`,
        `${user.displayName} joined the channel "${channel.name}"`
      ),
      Future.fromIOEither
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
      Future.fromIOEither
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
