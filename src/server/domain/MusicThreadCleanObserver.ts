import type { Guild, Message, ThreadChannel } from 'discord.js'
import { pipe } from 'fp-ts/function'

import { futureMaybe } from '../../shared/utils/FutureMaybe'
import { Future, Maybe, toUnit } from '../../shared/utils/fp'

import { DiscordConnector } from '../helpers/DiscordConnector'
import { MadEvent } from '../models/event/MadEvent'
import type { LoggerGetter } from '../models/logger/LoggerType'
import { ObserverWithRefinement } from '../models/rx/ObserverWithRefinement'
import type { GuildStateService } from '../services/GuildStateService'
import { LogUtils } from '../utils/LogUtils'

// We don't want any message (except bot) in the music logs thread

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const MusicThreadCleanObserver = (
  Logger: LoggerGetter,
  clientId: string,
  guildStateService: GuildStateService,
) => {
  const logger = Logger('MusicThreadCleanObserver')

  return ObserverWithRefinement.fromNext(
    MadEvent,
    'MessageCreate',
  )(({ message }) => {
    if (message.guild !== null && message.author.id !== clientId) {
      return pipe(
        getSubscriptionThread(message.guild),
        Future.map(Maybe.filter(messageIsInThreadAndIsNotBot(message))),
        futureMaybe.chainFuture(() => DiscordConnector.messageDelete(message)),
        futureMaybe.chainFuture(success =>
          success
            ? Future.unit
            : Future.fromIOEither(
                LogUtils.pretty(logger, message.guild, message.author, message.channel).info(
                  "Couldn't delete message in music thread",
                ),
              ),
        ),
        Future.map(toUnit),
      )
    }

    return Future.unit
  })

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
