import type { APIEmbed, BaseMessageOptions, Guild, GuildEmoji } from 'discord.js'
import { AttachmentBuilder } from 'discord.js'
import { apply } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'
import qs from 'qs'

import { DayJs } from '../../../shared/models/DayJs'
import { DiscordUserId } from '../../../shared/models/DiscordUserId'
import { StringUtils } from '../../../shared/utils/StringUtils'
import { objectEntries } from '../../../shared/utils/dictUtils'
import {
  Future,
  IO,
  List,
  Maybe,
  NonEmptyArray,
  PartialDict,
  Tuple,
} from '../../../shared/utils/fp'
import { futureMaybe } from '../../../shared/utils/futureMaybe'
import { safeNumber } from '../../../shared/utils/numberUtils'

import type { Resources } from '../../config/Resources'
import { constants } from '../../config/constants'
import { MessageComponent } from '../../models/discord/MessageComponent'
import { ChampionId } from '../../models/theQuest/ChampionId'
import { ChampionKey } from '../../models/theQuest/ChampionKey'
import { ChampionLevel_ } from '../../models/theQuest/ChampionLevel'
import { DDragonVersion } from '../../models/theQuest/DDragonVersion'
import type { PlatformWithRiotId } from '../../models/theQuest/PlatformWithRiotId'
import { RiotId } from '../../models/theQuest/RiotId'
import type { StaticData } from '../../models/theQuest/StaticData'
import type {
  TheQuestNotificationChampionLeveledUp,
  TheQuestNotificationUserJoined,
  TheQuestNotificationUserLeft,
} from '../../models/theQuest/TheQuestNotification'
import { TheQuestNotification } from '../../models/theQuest/TheQuestNotification'
import type { TheQuestProgressionApi } from '../../models/theQuest/TheQuestProgressionApi'
import { CanvasHelper } from '../CanvasHelper'
import { GuildHelper } from '../GuildHelper'

const otherTheQuestWebapp = 'https://la-quete.netlify.app'

/**
 * ranking
 */

type RankingArgs = {
  webappUrl: string
  guild: Guild
  progressions: List<TheQuestProgressionApi>
  updatedAt: DayJs
}

const ranking = ({
  webappUrl,
  guild,
  progressions,
  updatedAt,
}: RankingArgs): BaseMessageOptions => {
  const formatSummoner = getFormatSummoner(webappUrl)
  const theQuest = 'La Quête'

  return {
    embeds: [
      MessageComponent.safeEmbed({
        color: constants.messagesColor,
        title: pipe(
          constants.emojis.masteries[10],
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
                const grouped = pipe(
                  objectEntries(u.champions),
                  List.filterMap(([level, champions]) =>
                    pipe(
                      ChampionLevel_.fromNumber(safeNumber(level)),
                      Maybe.map(championLevel => Tuple.of(championLevel, champions)),
                    ),
                  ),
                  List.groupBy(([championLevel]) => `${championLevel}`),
                  PartialDict.map(champions =>
                    pipe(
                      champions,
                      NonEmptyArray.chain(([, cs]) => cs),
                      List.size,
                    ),
                  ),
                )

                const bullets = pipe(
                  ChampionLevel_.values,
                  List.reverse,
                  List.map(level =>
                    masteriesWithEmoji(constants.emojis.masteries[level], grouped[level] ?? 0),
                  ),
                  List.mkString(' • '),
                )

                return `${i + 1}. **${round1Fixed(u.percents)}%** ${formatSummoner(
                  u.summoner,
                )} ${formatUser(u.userId)}\n    ${bullets} — **${u.totalMasteryLevel}**`
              }),
              List.mkString('\n'),
            ),
          ),
        ),
        fields: [
          MessageComponent.field(
            ' ',
            StringUtils.stripMargins(
              `Pour apparaître dans ce classement, n’hésitez pas à demander aux admins.
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

  function masteriesWithEmoji(rawEmoji: string, n: number): string {
    const emoji = pipe(
      rawEmoji,
      GuildHelper.getEmoji(guild),
      Maybe.fold(() => rawEmoji, String),
    )
    return `${emoji} ${n}`
  }
}

/**
 * notification
 */

const thumbnailHeight = 42
const thumbnailGap = 8

type MessageOptionsWithEmoji = {
  messageOptions: BaseMessageOptions
  emoji: Maybe<string | GuildEmoji>
}

type EmbedWithAttachmentAndEmoji = {
  embed: APIEmbed
  attachment: Maybe<AttachmentBuilder>
  emoji: Maybe<string | GuildEmoji>
}

type NotificationsArgs = {
  webappUrl: string
  resources: Resources
  staticData: StaticData
  guild: Guild
}

const notification = ({
  webappUrl,
  resources,
  staticData,
  guild,
}: NotificationsArgs): ((notif: TheQuestNotification) => Future<MessageOptionsWithEmoji>) => {
  const ddragonUrls = getDdragonUrls(staticData.version)
  const formatSummoner = getFormatSummoner(webappUrl)

  return notif => {
    return pipe(
      notif,

      TheQuestNotification.match({
        UserJoined: notificationUserJoined,
        UserLeft: notificationUserLeft,
        ChampionLeveledUp: notificationChampionLeveledUp,
      }),
      Future.map(
        ({ embed, attachment, emoji }): MessageOptionsWithEmoji => ({
          messageOptions: {
            embeds: [embed],
            files: pipe(
              attachment,
              Maybe.fold(() => undefined, flow(List.of, List.asMutable)),
            ),
          },
          emoji,
        }),
      ),
    )

    function notificationUserJoined(
      n: Omit<TheQuestNotificationUserJoined, 'type'>,
    ): Future<EmbedWithAttachmentAndEmoji> {
      const attachmentName = `${n.summoner.profileIcondId}.png`
      return pipe(
        profileIconAttachment(n.summoner.profileIcondId, attachmentName),
        Future.map(
          (attachment): EmbedWithAttachmentAndEmoji => ({
            embed: MessageComponent.safeEmbed({
              description: `${summonerUser(n)} a rejoint le classement de La Quête !`,
              thumbnail: MessageComponent.thumbnail(attachmentUrl(attachmentName)),
            }),
            attachment: Maybe.some(attachment),
            emoji: Maybe.some(constants.emojis.tada),
          }),
        ),
      )
    }

    function profileIconAttachment(
      profileIcondId: number,
      attachmentName: string,
    ): Future<AttachmentBuilder> {
      return pipe(
        CanvasHelper.loadImage(ddragonUrls.profileIcon(profileIcondId)),
        Future.chainIOEitherK(profileIconImg =>
          pipe(
            CanvasHelper.createCanvas(thumbnailHeight, thumbnailHeight),
            IO.chain(
              CanvasHelper.canvasContext2DModify(
                CanvasHelper.contextDrawImage(
                  profileIconImg,
                  0,
                  0,
                  thumbnailHeight,
                  thumbnailHeight,
                ),
              ),
            ),
          ),
        ),
        Future.chain(CanvasHelper.canvasEncode('png')),
        Future.map(buffer => new AttachmentBuilder(buffer, { name: attachmentName })),
      )
    }

    function notificationUserLeft(
      n: Omit<TheQuestNotificationUserLeft, 'type'>,
    ): Future<EmbedWithAttachmentAndEmoji> {
      return Future.successful({
        embed: MessageComponent.safeEmbed({
          description: `${summonerUser(n)} a abandonné La Quête...`,
        }),
        attachment: Maybe.none,
        emoji: Maybe.some(constants.emojis.cry),
      })
    }

    function notificationChampionLeveledUp(
      n: Omit<TheQuestNotificationChampionLeveledUp, 'type'>,
    ): Future<EmbedWithAttachmentAndEmoji> {
      return pipe(
        staticData.champions,
        List.findFirst(c => ChampionKey.Eq.equals(c.key, n.champion.id)),
        futureMaybe.fromOption,
        futureMaybe.bindTo('champion'),
        futureMaybe.bind('attachment', ({ champion }) => {
          const attachmentName = `${ChampionId.unwrap(champion.id)}-mastery${n.champion.level}.png`
          return futureMaybe.fromTaskEither(
            apply.sequenceS(Future.ApplyPar)({
              attachment: championMasteryAttachment(champion.id, n.champion.level, attachmentName),
              name: Future.successful(attachmentName),
            }),
          )
        }),
        Future.map(
          (option): EmbedWithAttachmentAndEmoji => ({
            embed: MessageComponent.safeEmbed({
              description: `${summonerUser(
                n,
                pipe(
                  option,
                  Maybe.map(o => o.champion.name),
                ),
              )} est désormais maîtrise ${n.champion.level} avec **${pipe(
                option,
                Maybe.fold(
                  () => `<champion ${ChampionKey.unwrap(n.champion.id)}>`,
                  o => o.champion.name,
                ),
              )}** !`,
              thumbnail: pipe(
                option,
                Maybe.map(o => MessageComponent.thumbnail(attachmentUrl(o.attachment.name))),
                Maybe.toUndefined,
              ),
            }),
            attachment: pipe(
              option,
              Maybe.map(o => o.attachment.attachment),
            ),
            emoji: pipe(
              ChampionLevel_.fromNumber(n.champion.level),
              Maybe.chain(level => GuildHelper.getEmoji(guild)(constants.emojis.masteries[level])),
            ),
          }),
        ),
      )
    }

    function championMasteryAttachment(
      championId: ChampionId,
      championLevel: number,
      attachmentName: string,
    ): Future<AttachmentBuilder> {
      return pipe(
        apply.sequenceS(Future.ApplyPar)({
          championImg: CanvasHelper.loadImage(ddragonUrls.champion(championId)),
          masteryImg: pipe(
            ChampionLevel_.fromNumber(championLevel),
            Maybe.fold(
              () => Future.successful(Maybe.none),
              level =>
                pipe(CanvasHelper.loadImage(resources.mastery[level].path), Future.map(Maybe.some)),
            ),
          ),
        }),
        Future.chainIOEitherK(({ championImg, masteryImg }) =>
          pipe(
            // mastery image height is 42
            // champion image will be resized to 42x42
            // (we assume champion is always square, mastery isn't, but its height is already thumbnailHeight)
            CanvasHelper.createCanvas(
              thumbnailHeight +
                thumbnailGap +
                pipe(
                  masteryImg,
                  Maybe.fold(
                    () => 0,
                    img => img.width,
                  ),
                ),
              thumbnailHeight,
            ),
            IO.chain(
              CanvasHelper.canvasContext2DModify(
                flow(
                  CanvasHelper.contextDrawImage(
                    championImg,
                    0,
                    0,
                    thumbnailHeight,
                    thumbnailHeight,
                  ),
                  IO.chain(
                    pipe(
                      masteryImg,
                      Maybe.fold(
                        () => context => IO.right(context),
                        img =>
                          CanvasHelper.contextDrawImage(img, thumbnailHeight + thumbnailGap, 0),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
        Future.chain(CanvasHelper.canvasEncode('png')),
        Future.map(buffer => new AttachmentBuilder(buffer, { name: attachmentName })),
      )
    }

    function summonerUser(
      n: Pick<TheQuestNotificationUserLeft, 'userId' | 'summoner'>,
      search?: Maybe<string>,
    ): string {
      return `${formatSummoner(n.summoner, search)}${formatUser(n.userId)}`
    }
  }
}

export const TheQuestMessage = { ranking, notification }

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

const getFormatSummoner =
  (webappUrl: string) =>
  ({ platform, riotId }: PlatformWithRiotId, search: Maybe<string> = Maybe.none): string => {
    const query = {
      level: 'all',
      search: Maybe.toUndefined(search),
    }
    const queryStr = qs.stringify(query)
    const url = `${webappUrl}/${platform.toLowerCase()}/${RiotId.stringify('-')(
      riotId,
    )}?${queryStr}`
    return `[${RiotId.stringify('#')(riotId)}](${encodeURI(url)})`
  }

const attachmentUrl = (file: string): string => `attachment://${file}`
