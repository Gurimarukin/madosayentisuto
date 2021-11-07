import { GuildMember, StageChannel, VoiceChannel } from 'discord.js'
import { pipe } from 'fp-ts/function'

import { PublicCallEnded, PublicCallStarted } from '../../models/MadEvent'
import { TObserver } from '../../models/TObserver'
import { Future, Maybe } from '../../utils/fp'
import { LogUtils } from '../../utils/LogUtils'
import { DiscordConnector } from '../DiscordConnector'
import { GuildStateService } from '../GuildStateService'
import { PartialLogger } from '../Logger'

export const NotifyVoiceCallObserver = (
  Logger: PartialLogger,
  guildStateService: GuildStateService,
): TObserver<PublicCallStarted | PublicCallEnded> => {
  const logger = Logger('NotifyVoiceCallObserver')

  return {
    next: event => {
      switch (event.type) {
        case 'PublicCallStarted':
          return onPublicCallStarted(event.member, event.channel)

        case 'PublicCallEnded':
          return onPublicCallEnded(event.member, event.channel)
      }
    },
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
                      )(`Couldn't send call started notification in #${calls.channel.name}`),
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
                      )(`Couldn't send call ended notification in #${calls.channel.name}`),
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
