import { Guild, GuildChannel, GuildMember, StageChannel, VoiceChannel } from 'discord.js'
import { pipe } from 'fp-ts/function'

import {
  MadEvent,
  PublicCallEnded,
  PublicCallStarted,
  VoiceStateUpdate,
} from '../../models/MadEvent'
import { TObserver } from '../../models/TObserver'
import { TSubject } from '../../models/TSubject'
import { ChannelUtils } from '../../utils/ChannelUtils'
import { Future, List, Maybe } from '../../utils/fp'
import { LogUtils } from '../../utils/LogUtils'
import { DiscordConnector } from '../DiscordConnector'
import { GuildStateService } from '../GuildStateService'
import { PartialLogger } from '../Logger'

export const NotifyVoiceCallObserver = (
  Logger: PartialLogger,
  guildStateService: GuildStateService,
  subject: TSubject<PublicCallStarted | PublicCallEnded>,
): TObserver<VoiceStateUpdate | PublicCallStarted | PublicCallEnded> => {
  const logger = Logger('NotifyVoiceCallObserver')

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

        case 'PublicCallStarted':
          return onPublicCallStarted(event.member, event.channel)

        case 'PublicCallEnded':
          return onPublicCallEnded(event.member, event.channel)
      }
    },
  }

  function onJoinedChannel(
    member: GuildMember,
    channel: VoiceChannel | StageChannel,
  ): Future<void> {
    return pipe(
      LogUtils.withGuild(
        logger,
        'debug',
        channel.guild,
      )(`${member.user.tag} joined the channel #${channel.name}`),
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
      LogUtils.withGuild(
        logger,
        'debug',
        from.guild,
      )(`${member.user.tag} moved from channel #${from.name} to #${to.name}`),
      Future.fromIOEither,
      Future.chain(() => {
        const inPublicChans = peopleInPublicVocalChans(member.guild)

        if (
          ChannelUtils.isPrivate(from) &&
          ChannelUtils.isPublic(to) &&
          inPublicChans.length === 1
        ) {
          return Future.fromIOEither(subject.next(MadEvent.PublicCallStarted(member, to)))
        }

        if (
          ChannelUtils.isPublic(from) &&
          ChannelUtils.isPrivate(to) &&
          List.isEmpty(inPublicChans)
        ) {
          return Future.fromIOEither(subject.next(MadEvent.PublicCallEnded(member, to)))
        }

        return Future.unit
      }),
    )
  }

  function onLeftChannel(member: GuildMember, channel: VoiceChannel | StageChannel): Future<void> {
    return pipe(
      LogUtils.withGuild(
        logger,
        'debug',
        channel.guild,
      )(`${member.user.tag} left the channel #${channel.name}`),
      Future.fromIOEither,
      Future.chain(() =>
        ChannelUtils.isPublic(channel) && List.isEmpty(peopleInPublicVocalChans(member.guild))
          ? Future.fromIOEither(subject.next(MadEvent.PublicCallEnded(member, channel)))
          : Future.unit,
      ),
    )
  }

  function onPublicCallStarted(
    member: GuildMember,
    channel: VoiceChannel | StageChannel,
  ): Future<void> {
    return pipe(
      LogUtils.withGuild(
        logger,
        'info',
        member.guild,
      )(`Call started in #${channel.name} by ${member.user.tag}`),
      Future.fromIOEither,
      Future.chain(() => guildStateService.getCalls(member.guild)),
      Future.chain(
        Maybe.fold(
          () => Future.unit,
          calls =>
            pipe(
              DiscordConnector.sendMessage(
                calls.channel,
                `Ha ha ! **@${member.displayName}** appelle **#${channel.name}**... ${calls.role} doit payer !`,
              ),
              Future.chain(
                Maybe.fold(
                  () =>
                    Future.fromIOEither(
                      LogUtils.withGuild(
                        logger,
                        'warn',
                        member.guild,
                      )(`Couldn't send call started notification in #${calls.channel}`),
                    ),
                  () => Future.unit,
                ),
              ),
            ),
        ),
      ),
    )
  }

  function onPublicCallEnded(
    member: GuildMember,
    channel: VoiceChannel | StageChannel,
  ): Future<void> {
    return pipe(
      LogUtils.withGuild(
        logger,
        'info',
        member.guild,
      )(`Call ended in #${channel.name} by ${member.user.tag}`),
      Future.fromIOEither,
      Future.chain(() => guildStateService.getCalls(member.guild)),
      Future.chain(
        Maybe.fold(
          () => Future.unit,
          calls =>
            pipe(
              DiscordConnector.sendMessage(calls.channel, `Un appel s'est terminé.`),
              Future.chain(
                Maybe.fold(
                  () =>
                    Future.fromIOEither(
                      LogUtils.withGuild(
                        logger,
                        'warn',
                        member.guild,
                      )(`Couldn't send call ended notification in #${calls.channel}`),
                    ),
                  () => Future.unit,
                ),
              ),
            ),
        ),
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
