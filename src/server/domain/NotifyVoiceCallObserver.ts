import type { Channel, Guild, GuildMember } from 'discord.js'
import { predicate, refinement } from 'fp-ts'
import type { Predicate } from 'fp-ts/Predicate'
import type { Refinement } from 'fp-ts/Refinement'
import { pipe } from 'fp-ts/function'

import { DiscordUserId } from '../../shared/models/DiscordUserId'
import { ObserverWithRefinement } from '../../shared/models/rx/ObserverWithRefinement'
import type { NotUsed } from '../../shared/utils/fp'
import {
  Future,
  IO,
  List,
  Maybe,
  NonEmptyArray,
  Tuple,
  refinementFromPredicate,
  toNotUsed,
} from '../../shared/utils/fp'
import { futureMaybe } from '../../shared/utils/futureMaybe'

import { DiscordConnector } from '../helpers/DiscordConnector'
import { MadEvent } from '../models/event/MadEvent'
import type { Calls } from '../models/guildState/Calls'
import type { LoggerGetter } from '../models/logger/LoggerObservable'
import type { GuildStateService } from '../services/GuildStateService'
import type { GuildAudioChannel } from '../utils/ChannelUtils'
import { ChannelUtils } from '../utils/ChannelUtils'
import { LogUtils } from '../utils/LogUtils'

export const NotifyVoiceCallObserver = (
  Logger: LoggerGetter,
  clientId: DiscordUserId,
  guildStateService: GuildStateService,
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
) => {
  const logger = Logger('NotifyVoiceCallObserver')

  return ObserverWithRefinement.fromNext(
    MadEvent,
    'AudioChannelConnected',
    'AudioChannelMoved',
    'AudioChannelDisconnected',
  )(event => {
    if (DiscordUserId.fromUser(event.member.user) === clientId) return Future.notUsed

    return pipe(
      guildStateService.getCalls(event.member.guild),
      Future.chain(
        Maybe.fold(
          () => Future.notUsed,
          calls => {
            switch (event.type) {
              case 'AudioChannelConnected':
                return onAudioChannelConnected(event.member, event.channel, calls)

              case 'AudioChannelMoved':
                return onAudioChannelMoved(event.member, event.from, event.to, calls)

              case 'AudioChannelDisconnected':
                return onAudioChannelDisconnected(event.member, event.channel, calls)
            }
          },
        ),
      ),
    )
  })

  function onAudioChannelConnected(
    member: GuildMember,
    channel: GuildAudioChannel,
    calls: Calls,
  ): Future<NotUsed> {
    const isPublic = getIsPublic(calls.whitelistedChannels)

    return isPublic(channel) &&
      peopleInPublicAudioChans(member.guild, calls.whitelistedChannels).length === 1
      ? onPublicCallStarted(member, channel, calls)
      : Future.notUsed
  }

  function onAudioChannelMoved(
    member: GuildMember,
    from: GuildAudioChannel,
    to: GuildAudioChannel,
    calls: Calls,
  ): Future<NotUsed> {
    const inAudioChans = peopleInPublicAudioChans(member.guild, calls.whitelistedChannels)

    const isPublic = getIsPublic(calls.whitelistedChannels)
    const isPrivate = getIsPrivate(calls.whitelistedChannels)

    if (isPrivate(from) && isPublic(to) && inAudioChans.length === 1) {
      return onPublicCallStarted(member, to, calls)
    }

    if (isPublic(from) && isPrivate(to) && List.isEmpty(inAudioChans)) {
      return onPublicCallEnded(member, to, calls)
    }

    return Future.notUsed
  }

  function onAudioChannelDisconnected(
    member: GuildMember,
    channel: GuildAudioChannel,
    calls: Calls,
  ): Future<NotUsed> {
    const isPublic = getIsPublic(calls.whitelistedChannels)

    return isPublic(channel) &&
      List.isEmpty(peopleInPublicAudioChans(member.guild, calls.whitelistedChannels))
      ? onPublicCallEnded(member, channel, calls)
      : Future.notUsed
  }

  function onPublicCallStarted(
    member: GuildMember,
    channel: GuildAudioChannel,
    calls: Calls,
  ): Future<NotUsed> {
    const log = LogUtils.pretty(logger, member.guild)

    const hasRole = DiscordConnector.hasRole(member, calls.role)

    return pipe(
      log.info(`Call started in 📢${channel.name} by ${member.user.tag}`),
      Future.fromIOEither,
      Future.chain(() =>
        hasRole ? DiscordConnector.roleRemove(member, calls.role) : Future.successful(false),
      ),
      Future.chain(() =>
        DiscordConnector.sendMessage(
          calls.channel,
          `Haha ! **@${member.displayName}** appelle ${channel}... ${calls.role} doit payer !`,
        ),
      ),
      futureMaybe.match(
        () => log.warn(`Couldn't send call started notification in #${calls.channel.name}`),
        () => IO.notUsed,
      ),
      Future.chain(Future.fromIOEither),
      Future.chain(() =>
        hasRole ? DiscordConnector.roleAdd(member, calls.role) : Future.successful(false),
      ),
      Future.map(toNotUsed),
    )
  }

  function onPublicCallEnded(
    member: GuildMember,
    channel: GuildAudioChannel,
    calls: Calls,
  ): Future<NotUsed> {
    const log = LogUtils.pretty(logger, member.guild)

    return pipe(
      log.info(`Call ended in 📢${channel.name} by ${member.user.tag}`),
      Future.fromIOEither,
      Future.chain(() =>
        pipe(
          DiscordConnector.sendMessage(calls.channel, `Un appel s'est terminé.`),
          futureMaybe.match(
            () => log.warn(`Couldn't send call ended notification in #${calls.channel.name}`),
            () => IO.notUsed,
          ),
          Future.chain(Future.fromIOEither),
        ),
      ),
    )
  }

  // Actual humans, exclude bot (exclude clientId)
  function peopleInPublicAudioChans(
    guild: Guild,
    whitelistedChannels: Maybe<List<GuildAudioChannel>>,
  ): List<GuildMember> {
    return pipe(
      guild.channels.cache.toJSON(),
      List.filter(isPublicAudio(whitelistedChannels)),
      List.filterMap(channel =>
        pipe(
          channel.members.toJSON(),
          NonEmptyArray.fromReadonlyArray,
          Maybe.map(members => Tuple.of(channel, members)),
        ),
      ),
      List.chain(([, members]) => members),
      List.filter(member => DiscordUserId.fromUser(member.user) !== clientId), // don't count bot
    )
  }
}

const isPublicAudio = (
  whitelistedChannels: Maybe<List<GuildAudioChannel>>,
): Refinement<Channel, GuildAudioChannel> =>
  pipe(
    ChannelUtils.isGuildAudio,
    refinement.compose(
      refinementFromPredicate<GuildAudioChannel>(getIsPublic(whitelistedChannels)),
    ),
  )

const getIsPublic =
  (whitelistedChannels: Maybe<List<GuildAudioChannel>>): Predicate<GuildAudioChannel> =>
  channel =>
    pipe(
      whitelistedChannels,
      Maybe.fold(
        () => true, // allow all channels
        List.elem(ChannelUtils.Eq.byId)(channel),
      ),
    )

const getIsPrivate = (
  whitelistedChannels: Maybe<List<GuildAudioChannel>>,
): Predicate<GuildAudioChannel> => predicate.not(getIsPublic(whitelistedChannels))
