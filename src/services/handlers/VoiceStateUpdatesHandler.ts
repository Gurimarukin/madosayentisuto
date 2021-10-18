import { Guild, GuildMember, VoiceChannel } from 'discord.js'

import { DiscordConnector } from '../DiscordConnector'
import { PartialLogger } from '../Logger'
import { GuildStateService } from '../GuildStateService'
import { VoiceStateUpdate } from '../../models/VoiceStateUpdate'
import { Future, List, Maybe, pipe } from '../../utils/fp'
import { LogUtils } from '../../utils/LogUtils'
import { ChannelUtils } from '../../utils/ChannelUtils'

export const VoiceStateUpdatesHandler = (
  Logger: PartialLogger,
  guildStateService: GuildStateService,
  discord: DiscordConnector,
): ((voiceStateUpdate: VoiceStateUpdate) => Future<unknown>) => {
  const logger = Logger('VoiceStateUpdatesHandler')

  return voiceStateUpdate =>
    pipe(
      getMember(voiceStateUpdate),
      Maybe.map(member => {
        const oldChan = Maybe.fromNullable(voiceStateUpdate.oldState.channel)
        const newChan = Maybe.fromNullable(voiceStateUpdate.newState.channel)

        return Maybe.isNone(oldChan) && Maybe.isSome(newChan)
          ? onJoinedChannel(member, newChan.value)
          : Maybe.isSome(oldChan) && Maybe.isSome(newChan) && oldChan.value.id !== newChan.value.id
          ? onMovedChannel(member, oldChan.value, newChan.value)
          : Maybe.isSome(oldChan) && Maybe.isNone(newChan)
          ? onLeftChannel(member, oldChan.value)
          : Future.unit
      }),
      Maybe.getOrElse<Future<unknown>>(() => Future.unit),
    )

  /**
   * Event handlers
   */
  function onJoinedChannel(member: GuildMember, channel: VoiceChannel): Future<void> {
    return pipe(
      LogUtils.withGuild(
        logger,
        'debug',
        channel.guild,
      )(`${member.displayName} joined the channel "${channel.name}"`),
      Future.fromIOEither,
      Future.chain(_ =>
        ChannelUtils.isPublic(channel) && peopleInPublicVocalChans(member.guild).length === 1
          ? onPublicCallStarted(member, channel)
          : Future.unit,
      ),
    )
  }

  function onMovedChannel(member: GuildMember, from: VoiceChannel, to: VoiceChannel): Future<void> {
    return pipe(
      LogUtils.withGuild(
        logger,
        'debug',
        from.guild,
      )(`${member.displayName} moved from channel "${from.name}" to "${to.name}"`),
      Future.fromIOEither,
      Future.chain(_ => {
        const inPublicChans = peopleInPublicVocalChans(member.guild)
        return ChannelUtils.isPrivate(from) &&
          ChannelUtils.isPublic(to) &&
          inPublicChans.length === 1
          ? onPublicCallStarted(member, to)
          : ChannelUtils.isPublic(from) && ChannelUtils.isPrivate(to) && List.isEmpty(inPublicChans)
          ? onPublicCallEnded(member, to)
          : Future.unit
      }),
    )
  }

  function onLeftChannel(member: GuildMember, channel: VoiceChannel): Future<void> {
    return pipe(
      LogUtils.withGuild(
        logger,
        'debug',
        channel.guild,
      )(`${member.displayName} left the channel "${channel.name}"`),
      Future.fromIOEither,
      Future.chain(_ =>
        ChannelUtils.isPublic(channel) && List.isEmpty(peopleInPublicVocalChans(member.guild))
          ? onPublicCallEnded(member, channel)
          : Future.unit,
      ),
    )
  }

  function onPublicCallStarted(member: GuildMember, channel: VoiceChannel): Future<void> {
    return pipe(
      LogUtils.withGuild(
        logger,
        'info',
        member.guild,
      )(`Call started in "#${channel.name}" by "${member.user.tag}"`),
      Future.fromIOEither,
      Future.chain(_ => guildStateService.getCalls(member.guild)),
      Future.chain(
        Maybe.fold(
          () => Future.unit,
          calls =>
            pipe(
              discord.sendMessage(
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
                      )(`Couldn't send call started notification in ${calls.channel}`),
                    ),
                  _ => Future.unit,
                ),
              ),
            ),
        ),
      ),
    )
  }

  function onPublicCallEnded(member: GuildMember, channel: VoiceChannel): Future<void> {
    return pipe(
      LogUtils.withGuild(
        logger,
        'info',
        member.guild,
      )(`Call ended in "#${channel.name}" by "${member.user.tag}"`),
      Future.fromIOEither,
      Future.chain(_ => guildStateService.getCalls(member.guild)),
      Future.chain(
        Maybe.fold(
          () => Future.unit,
          calls =>
            pipe(
              discord.sendMessage(calls.channel, `Un appel s'est terminé.`),
              Future.chain(
                Maybe.fold(
                  () =>
                    Future.fromIOEither(
                      LogUtils.withGuild(
                        logger,
                        'warn',
                        member.guild,
                      )(`Couldn't send call ended notification in ${calls.channel}`),
                    ),
                  _ => Future.unit,
                ),
              ),
            ),
        ),
      ),
    )
  }
}

// ensures that we have the same id
function getMember(voiceStateUpdate: VoiceStateUpdate): Maybe<GuildMember> {
  return pipe(
    Maybe.fromNullable(voiceStateUpdate.oldState.member),
    Maybe.chain(u =>
      pipe(
        Maybe.fromNullable(voiceStateUpdate.newState.member),
        Maybe.filter(_ => _.id === u.id),
      ),
    ),
  )
}

function peopleInPublicVocalChans(guild: Guild): ReadonlyArray<GuildMember> {
  return pipe(
    guild.channels.cache.array(),
    List.filter(_ => ChannelUtils.isPublic(_) && ChannelUtils.isVoice(_)),
    List.chain(_ => _.members.array()),
  )
}
