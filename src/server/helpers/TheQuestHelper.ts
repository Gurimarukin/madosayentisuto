import type { Guild, GuildTextBasedChannel, Message } from 'discord.js'
import { ord } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'

import { DayJs } from '../../shared/models/DayJs'
import { DiscordUserId } from '../../shared/models/DiscordUserId'
import { Future, List, Maybe, NonEmptyArray } from '../../shared/utils/fp'
import { futureMaybe } from '../../shared/utils/futureMaybe'

import type { TheQuestConfig } from '../config/Config'
import { TheQuestProgression } from '../models/theQuest/TheQuestProgression'
import type { GuildStateService } from '../services/GuildStateService'
import type { TheQuestService } from '../services/TheQuestService'
import { ChannelUtils } from '../utils/ChannelUtils'
import { DiscordConnector } from './DiscordConnector'
import { theQuestRankingMessage } from './messages/theQuestRankingMessage'

type TheQuestHelper = ReturnType<typeof TheQuestHelper>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const TheQuestHelper = (
  config: TheQuestConfig,
  guildStateService: GuildStateService,
  theQuestService: TheQuestService,
) => {
  return {
    sendNotificationsAndRefreshMessage: (
      guild: Guild,
      channel: GuildTextBasedChannel,
    ): Future<Maybe<Message<true>>> =>
      pipe(
        DiscordConnector.fetchMembers(guild),
        Future.chain(members =>
          pipe(
            members.toJSON(),
            NonEmptyArray.fromReadonlyArray,
            Maybe.fold(
              () => Future.right([]),
              flow(
                NonEmptyArray.map(m => DiscordUserId.fromUser(m.user)),
                theQuestService.fetchForUsers,
              ),
            ),
          ),
        ),
        Future.map(List.sort(ord.reverse(TheQuestProgression.byPercentsOrd))),
        Future.bindTo('progressions'),
        Future.apS('oldMessage', guildStateService.getTheQuestMessage(guild)),
        Future.bind('notificationsIsEmpty', () => sendNotifications()),
        Future.bind('now', () => Future.fromIO(DayJs.now)),
        Future.chain(({ progressions, oldMessage, notificationsIsEmpty, now }) => {
          const options = theQuestRankingMessage({
            webappUrl: config.webappUrl,
            guild,
            progressions,
            updatedAt: now,
          })

          return pipe(
            oldMessage,
            Maybe.fold(
              () => sendRankingMessageAndUpdateState(),
              m =>
                notificationsIsEmpty && ChannelUtils.EqById.equals(m.channel, channel)
                  ? futureMaybe.fromTaskEither(DiscordConnector.messageEdit(m, options))
                  : sendRankingMessageAndUpdateState(),
            ),
          )

          function sendRankingMessageAndUpdateState(): Future<Maybe<Message<true>>> {
            return pipe(
              DiscordConnector.sendMessage(channel, options),
              futureMaybe.chainFirstTaskEitherK(m =>
                // we want the `(edited)` label on message so we won't have a layout shift
                DiscordConnector.messageEdit(m, options),
              ),
              Future.chainFirst(newMessage =>
                pipe(
                  oldMessage,
                  Maybe.fold(() => Future.right(true), DiscordConnector.messageDelete),
                  Future.chain(() => guildStateService.setTheQuestMessage(guild, newMessage)),
                ),
              ),
            )
          }
        }),
      ),
  }

  function sendNotifications(): Future<boolean> {
    const notificationsIsEmpty = true
    return Future.right(notificationsIsEmpty)
  }
}

export { TheQuestHelper }
