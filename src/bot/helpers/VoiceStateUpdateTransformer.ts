import type { Guild, GuildChannel, GuildMember, StageChannel, VoiceChannel } from 'discord.js'
import { pipe } from 'fp-ts/function'

import { Future, IO, List, Maybe } from 'shared/utils/fp'

import type { PublicCallEnded, PublicCallStarted, VoiceStateUpdate } from 'bot/models/MadEvent'
import { MadEvent } from 'bot/models/MadEvent'
import type { LoggerGetter } from 'bot/models/logger/LoggerType'
import type { TObserver } from 'bot/models/rx/TObserver'
import type { TSubject } from 'bot/models/rx/TSubject'
import { ChannelUtils } from 'bot/utils/ChannelUtils'
import { LogUtils } from 'bot/utils/LogUtils'

export const VoiceStateUpdateTransformer = (
  Logger: LoggerGetter,
  subject: TSubject<PublicCallStarted | PublicCallEnded>,
): TObserver<VoiceStateUpdate> => {
  const logger = Logger('VoiceStateUpdateTransformer')

  return {
    next: event => {
      switch (event.type) {
        case 'VoiceStateUpdate':
          return pipe(
            getMember(event),
            Maybe.fold(
              () => Future.unit,
              member => {
                const oldChan = Maybe.fromNullable(event.oldState.channel)
                const newChan = Maybe.fromNullable(event.newState.channel)

                if (Maybe.isNone(oldChan) && Maybe.isSome(newChan)) {
                  return onJoinedChannel(member, newChan.value)
                }

                if (
                  Maybe.isSome(oldChan) &&
                  Maybe.isSome(newChan) &&
                  oldChan.value.id !== newChan.value.id
                ) {
                  return onMovedChannel(member, oldChan.value, newChan.value)
                }

                if (Maybe.isSome(oldChan) && Maybe.isNone(newChan)) {
                  return onLeftChannel(member, oldChan.value)
                }

                return Future.unit
              },
            ),
          )
      }
    },
  }

  function onJoinedChannel(
    member: GuildMember,
    channel: VoiceChannel | StageChannel,
  ): Future<void> {
    return pipe(
      LogUtils.pretty(logger, channel.guild)(
        'debug',
        `${member.user.tag} joined the channel #${channel.name}`,
      ),
      Future.fromIOEither,
      Future.chain(() =>
        ChannelUtils.isPublic(channel) && peopleInPublicVocalChans(member.guild).length === 1
          ? Future.fromIOEither(subject.next(MadEvent.PublicCallStarted(member, channel)))
          : Future.unit,
      ),
    )
  }

  function onMovedChannel(
    member: GuildMember,
    from: VoiceChannel | StageChannel,
    to: VoiceChannel | StageChannel,
  ): Future<void> {
    return pipe(
      LogUtils.pretty(logger, from.guild)(
        'debug',
        `${member.user.tag} moved from channel #${from.name} to #${to.name}`,
      ),
      Future.fromIOEither,
      Future.map(() => {
        const inPublicChans = peopleInPublicVocalChans(member.guild)

        if (
          ChannelUtils.isPrivate(from) &&
          ChannelUtils.isPublic(to) &&
          inPublicChans.length === 1
        ) {
          return subject.next(MadEvent.PublicCallStarted(member, to))
        }

        if (
          ChannelUtils.isPublic(from) &&
          ChannelUtils.isPrivate(to) &&
          List.isEmpty(inPublicChans)
        ) {
          return subject.next(MadEvent.PublicCallEnded(member, to))
        }

        return IO.unit
      }),
      Future.chain(Future.fromIOEither),
    )
  }

  function onLeftChannel(member: GuildMember, channel: VoiceChannel | StageChannel): Future<void> {
    return pipe(
      LogUtils.pretty(logger, channel.guild)(
        'debug',
        `${member.user.tag} left the channel #${channel.name}`,
      ),
      Future.fromIOEither,
      Future.chain(() =>
        ChannelUtils.isPublic(channel) && List.isEmpty(peopleInPublicVocalChans(member.guild))
          ? Future.fromIOEither(subject.next(MadEvent.PublicCallEnded(member, channel)))
          : Future.unit,
      ),
    )
  }
}

// ensures that we have the same id
const getMember = ({ oldState, newState }: VoiceStateUpdate): Maybe<GuildMember> =>
  pipe(
    Maybe.fromNullable(oldState.member),
    Maybe.chain(memberOld =>
      pipe(
        Maybe.fromNullable(newState.member),
        Maybe.filter(memberNew => memberNew.id === memberOld.id),
      ),
    ),
  )

const peopleInPublicVocalChans = (guild: Guild): List<GuildMember> =>
  pipe(
    guild.channels.cache.toJSON(),
    List.filter(
      (c): c is GuildChannel =>
        ChannelUtils.isGuildChannel(c) &&
        ChannelUtils.isPublic(c) &&
        ChannelUtils.isVoiceChannel(c),
    ),
    List.chain(c => c.members.toJSON()),
  )
