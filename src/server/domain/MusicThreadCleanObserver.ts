import type { Guild, Message, ThreadChannel } from 'discord.js'
import { pipe } from 'fp-ts/function'

import { futureMaybe } from '../../shared/utils/FutureMaybe'
import { Future, Maybe } from '../../shared/utils/fp'

import { DiscordConnector } from '../helpers/DiscordConnector'
import type { MadEventMessageCreate } from '../models/events/MadEvent'
import type { LoggerGetter } from '../models/logger/LoggerType'
import type { TObserver } from '../models/rx/TObserver'
import type { GuildStateService } from '../services/GuildStateService'
import { LogUtils } from '../utils/LogUtils'

// We don't want any message (except bot) in the music logs thread
export const MusicThreadCleanObserver = (
  Logger: LoggerGetter,
  clientId: string,
  guildStateService: GuildStateService,
): TObserver<MadEventMessageCreate> => {
  const logger = Logger('MusicThreadCleanObserver')

  return {
    next: ({ message }) => {
      if (message.guild !== null && message.author.id !== clientId) {
        return pipe(
          getSubscriptionThread(message.guild),
          Future.map(Maybe.filter(messageIsInThreadAndIsNotBot(message))),
          futureMaybe.chainFuture(() => DiscordConnector.messageDelete(message)),
          futureMaybe.chainFuture(success =>
            success
              ? Future.unit
              : Future.fromIOEither(
                  LogUtils.pretty(logger, message.guild, message.author, message.channel).warn(
                    "Couldn't delete message in music thread",
                  ),
                ),
          ),
          Future.map(() => {}),
        )
      }

      return Future.unit
    },
  }

  function getSubscriptionThread(guild: Guild): Future<Maybe<ThreadChannel>> {
    return pipe(
      guildStateService.getSubscription(guild),
      Future.map(subscription => subscription.getState),
      Future.chain(Future.fromIOEither),
      Future.map(state => state.message),
      futureMaybe.chain(message => futureMaybe.fromNullable(message.thread)),
    )
  }
}

const messageIsInThreadAndIsNotBot =
  (message: Message) =>
  (thread: ThreadChannel): boolean =>
    thread.id === message.channelId
