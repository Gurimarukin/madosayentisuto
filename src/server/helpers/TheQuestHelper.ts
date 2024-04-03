import type { Guild, GuildTextBasedChannel, Message, MessageReaction } from 'discord.js'
import { apply, ord } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { DayJs } from '../../shared/models/DayJs'
import { DiscordUserId } from '../../shared/models/DiscordUserId'
import type { NotUsed } from '../../shared/utils/fp'
import { Future, List, Maybe, toNotUsed } from '../../shared/utils/fp'
import { futureMaybe } from '../../shared/utils/futureMaybe'

import type { TheQuestConfig } from '../config/Config'
import type { Resources } from '../config/Resources'
import { ChampionKey } from '../models/theQuest/ChampionKey'
import type { ChampionLevel } from '../models/theQuest/ChampionLevel'
import type { PlatformWithRiotId } from '../models/theQuest/PlatformWithRiotId'
import type { StaticData } from '../models/theQuest/StaticData'
import type { TheQuestNotificationChampionLeveledUp } from '../models/theQuest/TheQuestNotification'
import { TheQuestNotification } from '../models/theQuest/TheQuestNotification'
import { TheQuestProgressionApi } from '../models/theQuest/TheQuestProgressionApi'
import type { TheQuestProgressionDb } from '../models/theQuest/TheQuestProgressionDb'
import type { GuildStateService } from '../services/GuildStateService'
import type { TheQuestService } from '../services/TheQuestService'
import { ChannelUtils } from '../utils/ChannelUtils'
import { DiscordConnector } from './DiscordConnector'
import { TheQuestMessage } from './messages/TheQuestMessage'

type ProgressionsAndNotifications = {
  progressions: List<TheQuestProgressionApi>
  notifications: List<TheQuestNotification>
}

type TheQuestHelper = ReturnType<typeof TheQuestHelper>

const TheQuestHelper = (
  config: TheQuestConfig,
  resources: Resources,
  guildStateService: GuildStateService,
  theQuestService: TheQuestService,
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
) => {
  return {
    sendNotificationsAndRefreshMessage: (
      guild: Guild,
      channel: GuildTextBasedChannel,
    ): Future<Maybe<Message<true>>> =>
      pipe(
        fetchProgressionsAndNotifications(guild),
        Future.apS('staticData', theQuestService.api.staticData),
        Future.apS('oldMessage', guildStateService.getTheQuestMessage(guild)),
        Future.chainFirst(({ staticData, notifications }) =>
          sendNotifications(staticData, channel, notifications),
        ),
        Future.bind('now', () => Future.fromIO(DayJs.now)),
        Future.chain(({ progressions, notifications, oldMessage, now }) => {
          const options = TheQuestMessage.ranking({
            webappUrl: config.webappUrl,
            guild,
            progressions,
            updatedAt: now,
          })

          const sendRankingMessageAndUpdateState: Future<Maybe<Message<true>>> = pipe(
            DiscordConnector.sendMessage(channel, options),
            futureMaybe.chainFirstTaskEitherK(m =>
              // we want the `(edited)` label on message so we won't have a layout shift
              DiscordConnector.messageEdit(m, options),
            ),
            Future.chainFirst(newMessage =>
              pipe(
                oldMessage,
                Maybe.fold(() => Future.successful(true), DiscordConnector.messageDelete),
                Future.chain(() => guildStateService.setTheQuestMessage(guild, newMessage)),
              ),
            ),
          )

          return pipe(
            oldMessage,
            Maybe.fold(
              () => sendRankingMessageAndUpdateState,
              m =>
                List.isEmpty(notifications) && ChannelUtils.Eq.byId.equals(m.channel, channel)
                  ? futureMaybe.fromTaskEither(DiscordConnector.messageEdit(m, options))
                  : sendRankingMessageAndUpdateState,
            ),
          )
        }),
      ),
  }

  function fetchProgressionsAndNotifications(guild: Guild): Future<ProgressionsAndNotifications> {
    return pipe(
      DiscordConnector.fetchMembers(guild),
      Future.map(members =>
        pipe(
          members.toJSON(),
          List.map(m => DiscordUserId.fromUser(m.user)),
        ),
      ),
      Future.bindTo('memberIds'),
      Future.bind('progressions', ({ memberIds }) =>
        apply.sequenceS(Future.ApplyPar)({
          fromPersistence: theQuestService.persistence.listAllForIds(memberIds),
          fromApi: theQuestService.api.usersGetProgression(memberIds),
        }),
      ),
      Future.chain(({ progressions: { fromPersistence, fromApi } }) => {
        // remove those returned by persistence, but not by api
        const toRemove = pipe(
          fromPersistence,
          List.filter(
            ({ userId }) =>
              !pipe(
                fromApi,
                List.exists(p => DiscordUserId.Eq.equals(p.userId, userId)),
              ),
          ),
        )
        return pipe(
          apply.sequenceT(Future.ApplyPar)(
            pipe(
              toRemove,
              List.map(p => p.userId),
              theQuestService.persistence.removeForIds,
            ),
            theQuestService.persistence.bulkUpsert(fromApi),
          ),
          Future.map(
            (): ProgressionsAndNotifications => ({
              progressions: pipe(
                fromApi,
                List.sort(ord.reverse(TheQuestProgressionApi.byPercentsOrd)),
              ),
              notifications: getNotifications({ fromPersistence, toRemove, fromApi }),
            }),
          ),
        )
      }),
    )
  }

  type GetNotificationsArgs = {
    fromPersistence: List<TheQuestProgressionDb>
    toRemove: List<TheQuestProgressionDb>
    fromApi: List<TheQuestProgressionApi>
  }

  function getNotifications({
    fromPersistence,
    toRemove,
    fromApi,
  }: GetNotificationsArgs): List<TheQuestNotification> {
    const removedNotifications = pipe(
      toRemove,
      List.map(p =>
        TheQuestNotification.UserLeft({
          userId: p.userId,
          summoner: { platform: p.summoner.platform, riotId: p.summoner.riotId },
        }),
      ),
    )
    const otherNotifications = pipe(
      fromApi,
      List.chain(fromApi_ =>
        pipe(
          fromPersistence,
          List.findFirst(p => DiscordUserId.Eq.equals(p.userId, fromApi_.userId)),
          Maybe.fold(
            () =>
              List.of<TheQuestNotification>(
                TheQuestNotification.UserJoined({
                  userId: fromApi_.userId,
                  summoner: {
                    platform: fromApi_.summoner.platform,
                    riotId: fromApi_.summoner.riotId,
                    profileIcondId: fromApi_.summoner.profileIconId,
                  },
                }),
              ),
            apiPersistenceDifference(fromApi_),
          ),
        ),
      ),
    )
    return pipe(removedNotifications, List.concat(otherNotifications))
  }

  function apiPersistenceDifference(
    fromApi: TheQuestProgressionApi,
  ): (fromPersistence: TheQuestProgressionDb) => List<TheQuestNotification> {
    return fromPersistence => {
      const masteryDiff = masteryDifference(fromApi.userId, {
        platform: fromApi.summoner.platform,
        riotId: fromApi.summoner.riotId,
      })
      return pipe(
        masteryDiff(fromApi.champions.mastery5, fromPersistence.champions.mastery5, 5),
        List.concat(masteryDiff(fromApi.champions.mastery6, fromPersistence.champions.mastery6, 6)),
        List.concat(masteryDiff(fromApi.champions.mastery7, fromPersistence.champions.mastery7, 7)),
      )
    }
  }

  function sendNotifications(
    staticData: StaticData,
    channel: GuildTextBasedChannel,
    notifications: List<TheQuestNotification>,
  ): Future<NotUsed> {
    return pipe(
      notifications,
      // build notification messages in parallel
      List.traverse(Future.ApplicativePar)(
        TheQuestMessage.notification({
          webappUrl: config.webappUrl,
          resources,
          staticData,
          guild: channel.guild,
        }),
      ),
      Future.chain(options =>
        pipe(
          options,
          // send notification messages sequentially
          List.traverse(Future.ApplicativeSeq)(({ messageOptions }) =>
            DiscordConnector.sendMessage(channel, messageOptions),
          ),
          Future.map(List.zip(options)),
        ),
      ),
      Future.chain(
        // emoji react to messages in parallel
        List.traverse(Future.ApplicativePar)(([maybeMessage, { emoji: maybeEmoji }]) =>
          pipe(
            apply.sequenceS(Maybe.Apply)({ message: maybeMessage, emoji: maybeEmoji }),
            futureMaybe.fromOption,
            futureMaybe.chainTaskEitherK(({ message, emoji }) =>
              DiscordConnector.messageReact(message, emoji),
            ),
          ),
        ),
      ),
      Future.map<List<Maybe<MessageReaction>>, NotUsed>(toNotUsed),
    )
  }
}

export { TheQuestHelper }

const masteryDifference =
  (userId: DiscordUserId, summoner: PlatformWithRiotId) =>
  (
    xs: List<ChampionKey>,
    ys: List<ChampionKey>,
    championLevel: ChampionLevel,
  ): List<TheQuestNotificationChampionLeveledUp> =>
    pipe(
      List.difference(ChampionKey.Eq)(xs, ys),
      List.map(id =>
        TheQuestNotification.ChampionLeveledUp({
          userId,
          summoner,
          champion: { id, level: championLevel },
        }),
      ),
    )
