import type { Guild, GuildBasedChannel, GuildMember, StageChannel, VoiceChannel } from 'discord.js'
import { refinement } from 'fp-ts'
import type { Refinement } from 'fp-ts/Refinement'
import { pipe } from 'fp-ts/function'

import { Future, IO, List, Maybe, refinementFromPredicate } from '../../shared/utils/fp'

import type {
  MadEventPublicCallEnded,
  MadEventPublicCallStarted,
  MadEventVoiceStateUpdate,
} from '../models/event/MadEvent'
import { MadEvent } from '../models/event/MadEvent'
import type { LoggerGetter } from '../models/logger/LoggerGetter'
import { ObserverWithRefinement } from '../models/rx/ObserverWithRefinement'
import type { TSubject } from '../models/rx/TSubject'
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

  function onJoinedChannel(
    member: GuildMember,
    channel: VoiceChannel | StageChannel,
  ): Future<void> {
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
    from: VoiceChannel | StageChannel,
    to: VoiceChannel | StageChannel,
  ): Future<void> {
    return pipe(
      LogUtils.pretty(logger, from.guild).info(
        `${member.user.tag} moved from channel #${from.name} to #${to.name}`,
      ),
      Future.fromIOEither,
      Future.map(() => {
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
      Future.chain(Future.fromIOEither),
    )
  }

  function onLeftChannel(member: GuildMember, channel: VoiceChannel | StageChannel): Future<void> {
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
      List.filter(isPublicVocal),
      List.chain(c => c.members.toJSON()),
      List.filter(m => m.id !== clientId), // don't count bot
    )
  }
}

type VocalChannel = StageChannel | VoiceChannel

const isVocal: Refinement<GuildBasedChannel, VocalChannel> = pipe(
  ChannelUtils.isStageChannel,
  refinement.or(ChannelUtils.isVoiceChannel),
)
const isPublicVocal = pipe(
  isVocal,
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
