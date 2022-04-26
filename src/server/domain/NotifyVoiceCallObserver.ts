import type { GuildMember, StageChannel, VoiceChannel } from 'discord.js'
import { pipe } from 'fp-ts/function'

import { ObserverWithRefinement } from '../../shared/models/rx/ObserverWithRefinement'
import { Future, IO, toUnit } from '../../shared/utils/fp'
import { futureMaybe } from '../../shared/utils/futureMaybe'

import { DiscordConnector } from '../helpers/DiscordConnector'
import { MadEvent } from '../models/event/MadEvent'
import type { LoggerGetter } from '../models/logger/LoggerObservable'
import type { GuildStateService } from '../services/GuildStateService'
import { LogUtils } from '../utils/LogUtils'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const NotifyVoiceCallObserver = (
  Logger: LoggerGetter,
  guildStateService: GuildStateService,
) => {
  const logger = Logger('NotifyVoiceCallObserver')

  return ObserverWithRefinement.fromNext(
    MadEvent,
    'PublicCallStarted',
    'PublicCallEnded',
  )(event => {
    switch (event.type) {
      case 'PublicCallStarted':
        return onPublicCallStarted(event.member, event.channel)

      case 'PublicCallEnded':
        return onPublicCallEnded(event.member, event.channel)
    }
  })

  function onPublicCallStarted(
    member: GuildMember,
    channel: VoiceChannel | StageChannel,
  ): Future<void> {
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
            () => IO.unit,
          ),
          Future.chain(Future.fromIOEither),
        ),
      ),
      Future.map(toUnit),
    )
  }

  function onPublicCallEnded(
    member: GuildMember,
    channel: VoiceChannel | StageChannel,
  ): Future<void> {
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
            () => IO.unit,
          ),
          Future.chain(Future.fromIOEither),
        ),
      ),
      Future.map(toUnit),
    )
  }
}
