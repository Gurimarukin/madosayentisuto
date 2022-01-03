import type { GuildMember, StageChannel, VoiceChannel } from 'discord.js'
import { pipe } from 'fp-ts/function'

import { futureMaybe } from '../../shared/utils/FutureMaybe'
import { Future, IO } from '../../shared/utils/fp'

import { DiscordConnector } from '../helpers/DiscordConnector'
import type { MadEventPublicCallEnded, MadEventPublicCallStarted } from '../models/events/MadEvent'
import type { LoggerGetter } from '../models/logger/LoggerType'
import type { TObserver } from '../models/rx/TObserver'
import type { GuildStateService } from '../services/GuildStateService'
import { LogUtils } from '../utils/LogUtils'

export const NotifyVoiceCallObserver = (
  Logger: LoggerGetter,
  guildStateService: GuildStateService,
): TObserver<MadEventPublicCallStarted | MadEventPublicCallEnded> => {
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
      log('info', `Call started in 📢${channel.name} by ${member.user.tag}`),
      Future.fromIOEither,
      Future.chain(() => guildStateService.getCalls(member.guild)),
      futureMaybe.chainFuture(calls =>
        pipe(
          DiscordConnector.sendMessage(
            calls.channel,
            `Ha ha ! **@${member.displayName}** appelle ${channel}... ${calls.role} doit payer !`,
          ),
          futureMaybe.match(
            () => log('warn', `Couldn't send call started notification in #${calls.channel.name}`),
            () => IO.unit,
          ),
          Future.chain(Future.fromIOEither),
        ),
      ),
      Future.map(() => {}),
    )
  }

  function onPublicCallEnded(
    member: GuildMember,
    channel: VoiceChannel | StageChannel,
  ): Future<void> {
    const log = LogUtils.pretty(logger, member.guild)
    return pipe(
      log('info', `Call ended in 📢${channel.name} by ${member.user.tag}`),
      Future.fromIOEither,
      Future.chain(() => guildStateService.getCalls(member.guild)),
      futureMaybe.chainFuture(calls =>
        pipe(
          DiscordConnector.sendMessage(calls.channel, `Un appel s'est terminé.`),
          futureMaybe.match(
            () => log('warn', `Couldn't send call ended notification in #${calls.channel.name}`),
            () => IO.unit,
          ),
          Future.chain(Future.fromIOEither),
        ),
      ),
      Future.map(() => {}),
    )
  }
}
