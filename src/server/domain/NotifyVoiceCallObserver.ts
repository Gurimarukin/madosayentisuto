import type { Guild, GuildMember } from 'discord.js'
import { pipe } from 'fp-ts/function'

import { DiscordUserId } from '../../shared/models/DiscordUserId'
import { ObserverWithRefinement } from '../../shared/models/rx/ObserverWithRefinement'
import { LogUtils } from '../../shared/utils/LogUtils'
import type { NotUsed } from '../../shared/utils/fp'
import { Future, IO, List, toNotUsed } from '../../shared/utils/fp'
import { futureMaybe } from '../../shared/utils/futureMaybe'

import { DiscordConnector } from '../helpers/DiscordConnector'
import { GuildHelper } from '../helpers/GuildHelper'
import { MadEvent } from '../models/event/MadEvent'
import type { LoggerGetter } from '../models/logger/LoggerObservable'
import type { GuildStateService } from '../services/GuildStateService'
import type { GuildAudioChannel } from '../utils/ChannelUtils'
import { ChannelUtils } from '../utils/ChannelUtils'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const NotifyVoiceCallObserver = (
  Logger: LoggerGetter,
  clientId: DiscordUserId,
  guildStateService: GuildStateService,
) => {
  const logger = Logger('NotifyVoiceCallObserver')

  return ObserverWithRefinement.fromNext(
    MadEvent,
    'AudioChannelConnected',
    'AudioChannelMoved',
    'AudioChannelDisconnected',
  )(event => {
    if (DiscordUserId.fromUser(event.member.user) === clientId) return Future.notUsed

    switch (event.type) {
      case 'AudioChannelConnected':
        return onAudioChannelConnected(event.member, event.channel)

      case 'AudioChannelMoved':
        return onAudioChannelMoved(event.member, event.from, event.to)

      case 'AudioChannelDisconnected':
        return onAudioChannelDisconnected(event.member, event.channel)
    }
  })

  function onAudioChannelConnected(
    member: GuildMember,
    channel: GuildAudioChannel,
  ): Future<NotUsed> {
    return ChannelUtils.isPublic(channel) && peopleInPublicAudioChans(member.guild).length === 1
      ? onPublicCallStarted(member, channel)
      : Future.notUsed
  }

  function onAudioChannelMoved(
    member: GuildMember,
    from: GuildAudioChannel,
    to: GuildAudioChannel,
  ): Future<NotUsed> {
    const inPublicChans = peopleInPublicAudioChans(member.guild)

    if (ChannelUtils.isPrivate(from) && ChannelUtils.isPublic(to) && inPublicChans.length === 1) {
      return onPublicCallStarted(member, to)
    }

    if (ChannelUtils.isPublic(from) && ChannelUtils.isPrivate(to) && List.isEmpty(inPublicChans)) {
      return onPublicCallEnded(member, to)
    }

    return Future.notUsed
  }

  function onAudioChannelDisconnected(
    member: GuildMember,
    channel: GuildAudioChannel,
  ): Future<NotUsed> {
    return ChannelUtils.isPublic(channel) && List.isEmpty(peopleInPublicAudioChans(member.guild))
      ? onPublicCallEnded(member, channel)
      : Future.notUsed
  }

  function onPublicCallStarted(member: GuildMember, channel: GuildAudioChannel): Future<NotUsed> {
    const log = LogUtils.pretty(logger, member.guild)
    return pipe(
      log.info(`Call started in 📢${channel.name} by ${member.user.tag}`),
      Future.fromIOEither,
      Future.chain(() => guildStateService.getCalls(member.guild)),
      futureMaybe.chainTaskEitherK(calls =>
        pipe(
          DiscordConnector.sendMessage(
            calls.channel,
            `Ha ha ! **@${member.displayName}** appelle ${channel}... ${calls.role} doit payer !`,
          ),
          futureMaybe.match(
            () => log.warn(`Couldn't send call started notification in #${calls.channel.name}`),
            () => IO.notUsed,
          ),
          Future.chain(Future.fromIOEither),
        ),
      ),
      Future.map(toNotUsed),
    )
  }

  function onPublicCallEnded(member: GuildMember, channel: GuildAudioChannel): Future<NotUsed> {
    const log = LogUtils.pretty(logger, member.guild)
    return pipe(
      log.info(`Call ended in 📢${channel.name} by ${member.user.tag}`),
      Future.fromIOEither,
      Future.chain(() => guildStateService.getCalls(member.guild)),
      futureMaybe.chainTaskEitherK(calls =>
        pipe(
          DiscordConnector.sendMessage(calls.channel, `Un appel s'est terminé.`),
          futureMaybe.match(
            () => log.warn(`Couldn't send call ended notification in #${calls.channel.name}`),
            () => IO.notUsed,
          ),
          Future.chain(Future.fromIOEither),
        ),
      ),
      Future.map(toNotUsed),
    )
  }

  // Actual humans, exclude bot (exclude clientId)
  function peopleInPublicAudioChans(guild: Guild): List<GuildMember> {
    return pipe(
      GuildHelper.membersInPublicAudioChans(guild),
      List.chain(([, members]) => members),
      List.filter(member => DiscordUserId.fromUser(member.user) !== clientId),
    )
  }
}
