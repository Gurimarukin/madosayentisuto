import type { GuildMember, StageChannel, VoiceChannel } from 'discord.js'
import { pipe } from 'fp-ts/function'

import { Future, Maybe } from 'shared/utils/fp'

import { DiscordConnector } from 'bot/helpers/DiscordConnector'
import type { PublicCallEnded, PublicCallStarted } from 'bot/models/MadEvent'
import type { LoggerGetter } from 'bot/models/logger/LoggerType'
import type { TObserver } from 'bot/models/rx/TObserver'
import type { GuildStateService } from 'bot/services/GuildStateService'
import { LogUtils } from 'bot/utils/LogUtils'

export const NotifyVoiceCallObserver = (
  Logger: LoggerGetter,
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
    const log = LogUtils.pretty(logger, member.guild)
    return pipe(
      log('info', `Call started in #${channel.name} by ${member.user.tag}`),
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
                      log(
                        'warn',
                        `Couldn't send call started notification in #${calls.channel.name}`,
                      ),
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
    const log = LogUtils.pretty(logger, member.guild)
    return pipe(
      log('info', `Call ended in #${channel.name} by ${member.user.tag}`),
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
                      log(
                        'warn',
                        `Couldn't send call ended notification in #${calls.channel.name}`,
                      ),
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
