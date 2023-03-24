import type { Guild, Message, PartialTextBasedChannelFields } from 'discord.js'
import { flow, pipe } from 'fp-ts/function'

import { DayJs } from '../../shared/models/DayJs'
import { DiscordUserId } from '../../shared/models/DiscordUserId'
import { Future, Maybe, NonEmptyArray } from '../../shared/utils/fp'

import type { TheQuestConfig } from '../config/Config'
import type { GuildStateService } from '../services/GuildStateService'
import type { TheQuestService } from '../services/TheQuestService'
import { DiscordConnector } from './DiscordConnector'
import { theQuestRankingMessage } from './messages/theQuestRankingMessage'

type TheQuestHelper = ReturnType<typeof TheQuestHelper>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const TheQuestHelper = (
  config: TheQuestConfig,
  guildStateService: GuildStateService,
  theQuestService: TheQuestService,
) => ({
  sendNotificationsAndRefreshMessage: (
    guild: Guild,
    channel: PartialTextBasedChannelFields<true>,
  ): Future<Maybe<Message<true>>> => {
    const res = pipe(
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
      Future.bindTo('progressions'),
      Future.apS('oldMessage', guildStateService.getTheQuestMessage(guild)),
      Future.bind('now', () => Future.fromIO(DayJs.now)),
      Future.bind('newMessage', ({ progressions, now }) =>
        DiscordConnector.sendMessage(
          channel,
          theQuestRankingMessage({
            webappUrl: config.webappUrl,
            guild,
            progressions,
            updatedAt: now,
          }),
        ),
      ),
      Future.chainFirst(({ oldMessage, newMessage }) =>
        pipe(
          oldMessage,
          Maybe.fold(() => Future.right(true), DiscordConnector.messageDelete),
          Future.chain(() => guildStateService.setTheQuestMessage(guild, newMessage)),
        ),
      ),
      Future.map(({ newMessage }) => newMessage),
    )
    return res
  },
})

export { TheQuestHelper }
