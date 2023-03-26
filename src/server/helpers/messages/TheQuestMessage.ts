import type { APIEmbed, BaseMessageOptions, Guild } from 'discord.js'
import { flow, pipe } from 'fp-ts/function'

import { DayJs } from '../../../shared/models/DayJs'
import { DiscordUserId } from '../../../shared/models/DiscordUserId'
import { StringUtils } from '../../../shared/utils/StringUtils'
import type { Dict } from '../../../shared/utils/fp'
import { List, Maybe, NonEmptyArray } from '../../../shared/utils/fp'

import { constants } from '../../config/constants'
import { MessageComponent } from '../../models/discord/MessageComponent'
import { ChampionId } from '../../models/theQuest/ChampionId'
import { ChampionKey } from '../../models/theQuest/ChampionKey'
import { DDragonVersion } from '../../models/theQuest/DDragonVersion'
import type { PlatformWithName } from '../../models/theQuest/PlatformWithName'
import type { StaticData } from '../../models/theQuest/StaticData'
import type {
  TheQuestNotificationChampionLeveledUp,
  TheQuestNotificationUserJoined,
  TheQuestNotificationUserLeft,
} from '../../models/theQuest/TheQuestNotification'
import { TheQuestNotification } from '../../models/theQuest/TheQuestNotification'
import type { TheQuestProgressionApi } from '../../models/theQuest/TheQuestProgressionApi'
import { GuildHelper } from '../GuildHelper'

const otherTheQuestWebapp = 'https://la-quete.netlify.app'

type Mastery = TheQuestNotificationChampionLeveledUp['champion']['level']

const masteryImage: Dict<`${Mastery}`, string> = {
  7: 'https://cdn.discordapp.com/attachments/636626556734930948/1089586964895907940/mastery-7-42.png',
  6: 'https://cdn.discordapp.com/attachments/636626556734930948/1089586984961441872/mastery-6-42.png',
  5: 'https://cdn.discordapp.com/attachments/636626556734930948/1089587003798081628/mastery-5-42.png',
}

type RankingArgs = {
  readonly webappUrl: string
  readonly guild: Guild
  readonly progressions: List<TheQuestProgressionApi>
  readonly updatedAt: DayJs
}

const ranking = ({
  webappUrl,
  guild,
  progressions,
  updatedAt,
}: RankingArgs): BaseMessageOptions => {
  const webappUrlRegister = `${webappUrl}/register`
  const formatSummoner = getFormatSummoner(getSummonerUrl(webappUrl))
  const theQuest = 'La Quête'

  return {
    embeds: [
      MessageComponent.safeEmbed({
        color: constants.messagesColor,
        title: pipe(
          constants.emojis.mastery7,
          GuildHelper.getEmoji(guild),
          Maybe.fold(
            () => theQuest,
            e => `${e}  ${theQuest}`,
          ),
        ),
        description: pipe(
          progressions,
          NonEmptyArray.fromReadonlyArray,
          Maybe.fold(
            () =>
              StringUtils.stripMargins(
                `> ${constants.emptyChar}
                |> Ce classement est bien vide *pour l’instant*...
                |> ${constants.emptyChar}`,
              ),
            flow(
              NonEmptyArray.mapWithIndex((i, u) => {
                const summonerLinkAndUser = `${formatSummoner(u.summoner)} ${formatUser(u.userId)}`
                const bullets = pipe(
                  [
                    `**${round1Fixed(u.percents)}%**`,
                    summonerLinkAndUser,
                    masteriesWithEmoji(u.champions.mastery7.length, constants.emojis.mastery7),
                    masteriesWithEmoji(u.champions.mastery6.length, constants.emojis.mastery6),
                    masteriesWithEmoji(u.champions.mastery5.length, constants.emojis.mastery5),
                    `**${u.totalMasteryLevel}**`,
                  ],
                  List.mkString(' • '),
                )
                return `${i + 1}. ${bullets}`
              }),
              List.mkString('\n'),
            ),
          ),
        ),
        fields: [
          MessageComponent.field(
            '—',
            StringUtils.stripMargins(
              `Pour apparaître dans ce classement, il suffit de [s’inscrire](${webappUrlRegister}).
              |
              |${constants.emojis.link}  [site de La Quête](${webappUrl})
              |${constants.emojis.link}  [l’autre site de La Quête](${otherTheQuestWebapp})`,
            ),
            false,
          ),
        ],
        timestamp: DayJs.toDate(updatedAt),
        footer: MessageComponent.footer('Mis à jour'),
      }),
    ],
  }

  function masteriesWithEmoji(n: number, rawEmoji: string): string {
    const emoji = pipe(
      rawEmoji,
      GuildHelper.getEmoji(guild),
      Maybe.fold(() => rawEmoji, String),
    )
    return `${n} ${emoji}`
  }
}

type NotificationsArgs = {
  readonly webappUrl: string
  readonly staticData: StaticData
}

const notifications =
  ({ webappUrl, staticData }: NotificationsArgs) =>
  (nea: NonEmptyArray<TheQuestNotification>): BaseMessageOptions => {
    const ddragonUrls = getDdragonUrls(staticData.version)
    const summonerUrl = getSummonerUrl(webappUrl)
    const formatSummoner = getFormatSummoner(summonerUrl)

    return {
      embeds: pipe(
        nea,
        NonEmptyArray.map(
          TheQuestNotification.match({
            UserJoined: notificationUserJoined,
            UserLeft: notificationUserLeft,
            ChampionLeveledUp: notificationChampionLeveledUp,
          }),
        ),
        NonEmptyArray.asMutable,
      ),
    }

    function notificationUserJoined(n: Omit<TheQuestNotificationUserJoined, 'type'>): APIEmbed {
      return MessageComponent.safeEmbed({
        description: `${userSummoner(n)} a rejoint le classement de La Quête !`,
        thumbnail: MessageComponent.thumbnail(ddragonUrls.profileIcon(n.summoner.profileIcondId)),
      })
    }

    function notificationUserLeft(n: Omit<TheQuestNotificationUserLeft, 'type'>): APIEmbed {
      return MessageComponent.safeEmbed({
        description: `${userSummoner(n)} a abandonné La Quête...`,
      })
    }

    function notificationChampionLeveledUp(
      n: Omit<TheQuestNotificationChampionLeveledUp, 'type'>,
    ): APIEmbed {
      const champion = pipe(
        staticData.champions,
        List.findFirst(c => ChampionKey.Eq.equals(c.key, n.champion.id)),
      )
      return MessageComponent.safeEmbed({
        description: `${userSummoner(n)} est désormais maîtrise ${n.champion.level} avec ${pipe(
          champion,
          Maybe.fold(
            () => `<champion ${ChampionKey.unwrap(n.champion.id)}>`,
            c => c.name,
          ),
        )} !`,
        thumbnail: MessageComponent.thumbnail(masteryImage[n.champion.level]),
        image: pipe(
          champion,
          Maybe.map(c => MessageComponent.image(ddragonUrls.champion(c.id))),
          Maybe.toUndefined,
        ),
      })
    }

    function userSummoner(n: Pick<TheQuestNotificationUserLeft, 'userId' | 'summoner'>): string {
      return `${formatUser(n.userId)} (${formatSummoner(n.summoner)})`
    }
  }

export const TheQuestMessage = { ranking, notifications }

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const getDdragonUrls = (version: DDragonVersion) => ({
  profileIcon: (id: number) =>
    `http://ddragon.leagueoflegends.com/cdn/${DDragonVersion.unwrap(
      version,
    )}/img/profileicon/${id}.png`,
  champion: (id: ChampionId): string =>
    `http://ddragon.leagueoflegends.com/cdn/${DDragonVersion.unwrap(
      version,
    )}/img/champion/${ChampionId.unwrap(id)}.png`,
})

const round1Fixed = (n: number): string => (Math.round(n * 10) / 10).toFixed(1)

const formatUser = (id: DiscordUserId): string => `<@${DiscordUserId.unwrap(id)}>`

const getSummonerUrl =
  (webappUrl: string) =>
  ({ platform, name }: PlatformWithName): string =>
    `${webappUrl}/${platform}/${name}}`

const getFormatSummoner =
  (summonerUrl: ReturnType<typeof getSummonerUrl>) =>
  (summoner: PlatformWithName): string =>
    `[${summoner.name}](${summonerUrl(summoner)})`
