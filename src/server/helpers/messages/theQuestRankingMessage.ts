import type { BaseMessageOptions, Guild } from 'discord.js'
import { flow, pipe } from 'fp-ts/function'

import { DayJs } from '../../../shared/models/DayJs'
import { DiscordUserId } from '../../../shared/models/DiscordUserId'
import { StringUtils } from '../../../shared/utils/StringUtils'
import { List, Maybe, NonEmptyArray } from '../../../shared/utils/fp'

import { constants } from '../../config/constants'
import { MessageComponent } from '../../models/discord/MessageComponent'
import type { Summoner } from '../../models/theQuest/Summoner'
import type { TheQuestProgression } from '../../models/theQuest/TheQuestProgression'
import { GuildHelper } from '../GuildHelper'

const otherTheQuestWebapp = 'https://la-quete.netlify.app'

type Args = {
  readonly webappUrl: string
  readonly guild: Guild
  readonly progressions: List<TheQuestProgression>
  readonly updatedAt: DayJs
}

export const theQuestRankingMessage = ({
  webappUrl,
  guild,
  progressions,
  updatedAt,
}: Args): BaseMessageOptions => {
  const webappUrls = {
    register: `${webappUrl}/register`,
    summoner: ({ platform, name }: Summoner) => `${webappUrl}/${platform}/${name}`,
  }

  return {
    embeds: [
      MessageComponent.safeEmbed({
        color: constants.messagesColor,
        title: 'La Quête',
        thumbnail: MessageComponent.thumbnail(constants.theQuest.iconYuumi, 32, 32),
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
                const summonerLinkAndUser = `[${u.summoner.name}](${webappUrls.summoner(
                  u.summoner,
                )}/) (<@${DiscordUserId.unwrap(u.userId)}>)`
                const masteries = pipe(
                  [
                    masteriesWithEmoji(u.champions.mastery7.length, constants.emojis.mastery7),
                    masteriesWithEmoji(u.champions.mastery6.length, constants.emojis.mastery6),
                    masteriesWithEmoji(u.champions.mastery5.length, constants.emojis.mastery5),
                    `${u.totalMasteryLevel}`,
                  ],
                  List.mkString(' • '),
                )
                return `${i + 1}. **${round1Fixed(
                  u.percents,
                )}%** ${summonerLinkAndUser} — ${masteries}`
              }),
              List.mkString('\n'),
            ),
          ),
        ),
        fields: [
          MessageComponent.field(
            '—',
            StringUtils.stripMargins(
              `Pour apparaître dans ce classement, il suffit de [s’inscrire ici](${webappUrls.register}).
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
      Maybe.fold(
        () => rawEmoji,
        e => `${e}`,
      ),
    )
    return `${n} ${emoji}`
  }
}

const round1Fixed = (n: number): string => (Math.round(n * 10) / 10).toFixed(1)
