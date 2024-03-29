import type { Guild, Message, ThreadChannel } from 'discord.js'
import { pipe } from 'fp-ts/function'

import { DiscordUserId } from '../../shared/models/DiscordUserId'
import { ObserverWithRefinement } from '../../shared/models/rx/ObserverWithRefinement'
import type { Maybe } from '../../shared/utils/fp'
import { Future, toNotUsed } from '../../shared/utils/fp'
import { futureMaybe } from '../../shared/utils/futureMaybe'

import { DiscordConnector } from '../helpers/DiscordConnector'
import { AudioState } from '../models/audio/AudioState'
import { MadEvent } from '../models/event/MadEvent'
import type { LoggerGetter } from '../models/logger/LoggerObservable'
import type { GuildStateService } from '../services/GuildStateService'
import { LogUtils } from '../utils/LogUtils'

// We don't want any message (except bot) in the music logs thread

export const PlayerThreadCleanObserver = (
  Logger: LoggerGetter,
  clientId: DiscordUserId,
  guildStateService: GuildStateService,
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
) => {
  const logger = Logger('PlayerThreadCleanObserver')

  return ObserverWithRefinement.fromNext(
    MadEvent,
    'MessageCreate',
  )(({ message }) => {
    if (message.guild !== null && DiscordUserId.fromUser(message.author) !== clientId) {
      return pipe(
        getSubscriptionThread(message.guild),
        futureMaybe.filter(messageIsInThreadAndIsNotBot(message)),
        futureMaybe.chainTaskEitherK(() => DiscordConnector.messageDelete(message)),
        futureMaybe.chainTaskEitherK(success =>
          success
            ? Future.notUsed
            : Future.fromIOEither(
                LogUtils.pretty(logger, message.guild, message.author, message.channel).info(
                  "Couldn't delete message in player thread",
                ),
              ),
        ),
        Future.map(toNotUsed),
      )
    }

    return Future.notUsed
  })

  function getSubscriptionThread(guild: Guild): Future<Maybe<ThreadChannel>> {
    return pipe(
      guildStateService.getSubscription(guild),
      Future.chainIOK(subscription => subscription.getAudioState),
      futureMaybe.fromTaskEither,
      futureMaybe.filter(AudioState.isNotConnected),
      futureMaybe.chainOptionK(state => state.value.message),
      futureMaybe.chain(message => futureMaybe.fromNullable(message.thread)),
    )
  }
}

const messageIsInThreadAndIsNotBot =
  (message: Message) =>
  (thread: ThreadChannel): boolean =>
    thread.id === message.channelId
