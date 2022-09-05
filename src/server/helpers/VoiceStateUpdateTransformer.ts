import type { Guild, GuildMember } from 'discord.js'
import { refinement } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { ObserverWithRefinement } from '../../shared/models/rx/ObserverWithRefinement'
import type { TSubject } from '../../shared/models/rx/TSubject'
import { Future, IO, List, Maybe, refinementFromPredicate } from '../../shared/utils/fp'

import type {
  MadEventPublicCallEnded,
  MadEventPublicCallStarted,
  MadEventVoiceStateUpdate,
} from '../models/event/MadEvent'
import { MadEvent } from '../models/event/MadEvent'
import type { LoggerGetter } from '../models/logger/LoggerObservable'
import type { GuildAudioChannel } from '../utils/ChannelUtils'
import { ChannelUtils } from '../utils/ChannelUtils'
import { LogUtils } from '../utils/LogUtils'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const VoiceStateUpdateTransformer = (
  Logger: LoggerGetter,
  clientId: string,
  subject: TSubject<MadEventPublicCallStarted | MadEventPublicCallEnded>,
) => {
  const logger = Logger('VoiceStateUpdateTransformer')

  return ObserverWithRefinement.fromNext(
    MadEvent,
    'VoiceStateUpdate',
  )(event =>
    pipe(
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
    ),
  )

  function onJoinedChannel(member: GuildMember, channel: GuildAudioChannel): Future<void> {
    return pipe(
      LogUtils.pretty(logger, channel.guild).info(
        `${member.user.tag} joined the channel #${channel.name}`,
      ),
      IO.chain(() =>
        ChannelUtils.isPublic(channel) &&
        peopleInPublicVocalChans(member.guild).length === 1 &&
        member.id !== clientId
          ? subject.next(MadEvent.PublicCallStarted(member, channel))
          : IO.unit,
      ),
      Future.fromIOEither,
    )
  }

  function onMovedChannel(
    member: GuildMember,
    from: GuildAudioChannel,
    to: GuildAudioChannel,
  ): Future<void> {
    return pipe(
      LogUtils.pretty(logger, from.guild).info(
        `${member.user.tag} moved from channel #${from.name} to #${to.name}`,
      ),
      Future.fromIOEither,
      Future.chainIOEitherK(() => {
        if (member.id === clientId) return IO.unit

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
    )
  }

  function onLeftChannel(member: GuildMember, channel: GuildAudioChannel): Future<void> {
    return pipe(
      LogUtils.pretty(logger, channel.guild).info(
        `${member.user.tag} left the channel #${channel.name}`,
      ),
      IO.chain(() =>
        ChannelUtils.isPublic(channel) &&
        List.isEmpty(peopleInPublicVocalChans(member.guild)) &&
        member.id !== clientId
          ? subject.next(MadEvent.PublicCallEnded(member, channel))
          : IO.unit,
      ),
      Future.fromIOEither,
    )
  }

  function peopleInPublicVocalChans(guild: Guild): List<GuildMember> {
    return pipe(
      guild.channels.cache.toJSON(),
      List.filter(isPublicAudio),
      List.chain(c => c.members.toJSON()),
      List.filter(m => m.id !== clientId), // don't count bot
    )
  }
}

const isPublicAudio = pipe(
  ChannelUtils.isGuildAudio,
  refinement.compose(refinementFromPredicate(ChannelUtils.isPublic)),
)

// ensures that we have the same id
const getMember = ({ oldState, newState }: MadEventVoiceStateUpdate): Maybe<GuildMember> =>
  pipe(
    Maybe.fromNullable(oldState.member),
    Maybe.chain(memberOld =>
      pipe(
        Maybe.fromNullable(newState.member),
        Maybe.filter(memberNew => memberNew.id === memberOld.id),
      ),
    ),
  )
