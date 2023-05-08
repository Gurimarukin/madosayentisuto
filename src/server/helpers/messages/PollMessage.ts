import type { BaseMessageOptions } from 'discord.js'
import { ButtonStyle } from 'discord.js'
import { pipe } from 'fp-ts/function'

import { DiscordUserId } from '../../../shared/models/DiscordUserId'
import { StringUtils } from '../../../shared/utils/StringUtils'
import { List, Maybe, NonEmptyArray } from '../../../shared/utils/fp'

import { constants } from '../../config/constants'
import type { ButtonWithCustomIdOptions } from '../../models/discord/MessageComponent'
import { MessageComponent } from '../../models/discord/MessageComponent'
import type { ChoiceWithResponses } from '../../models/poll/ChoiceWithResponses'
import type { ChoiceWithVotesCount } from '../../models/poll/ChoiceWithVotesCount'
import { PollButton } from '../../models/poll/PollButton'

const pollGraphWidth = 20 // chars

// emojis

type EmojiKey = keyof typeof constants.emojis.characters

const emojis = pipe(
  NonEmptyArray.range(97, 122), // [97-122]: [a-z]
  NonEmptyArray.map(i => constants.emojis.characters[String.fromCharCode(i) as EmojiKey]),
)

const getEmoji = (i: number): Maybe<string> => List.lookup(i, emojis)

// format

const splitWith = '  '

type PollOptions = {
  isAnonymous: boolean
  isMultiple: boolean
}

const poll = (
  question: string,
  answers: NonEmptyArray<ChoiceWithVotesCount>,
  { isAnonymous, isMultiple }: PollOptions,
): BaseMessageOptions => {
  const total = pipe(
    answers,
    List.reduce(0, (acc, a) => acc + a.votesCount),
  )

  const answersStr = pipe(
    answers,
    NonEmptyArray.mapWithIndex((index, { choice, votesCount }) => {
      const emoji = pipe(
        getEmoji(index),
        Maybe.getOrElse(() => `${index}`),
      )
      return StringUtils.stripMargins(
        `${emoji}${splitWith}${choice}
        |${graphBar(votesCount, total)}`,
      )
    }),
    List.mkString('\n\n'),
  )

  return {
    embeds: [
      MessageComponent.safeEmbed({
        title: question,
        description: StringUtils.stripMargins(
          `${answersStr}
          |
          |Total de réponses : ${total}
          |*anonyme :* \`${StringUtils.booleanLabel(
            isAnonymous,
          ).toLowerCase()}\`, *choix multiple :* \`${StringUtils.booleanLabel(
            isMultiple,
          ).toLowerCase()}\``,
        ),
        color: constants.messagesColor,
      }),
    ],
    components: [
      pipe(
        answers,
        NonEmptyArray.mapWithIndex(index =>
          MessageComponent.buttonWithCustomId({
            custom_id: PollButton.codec.encode(PollButton.of(index)),
            style: ButtonStyle.Secondary,
            ...pipe(
              getEmoji(index),
              Maybe.fold<string, Pick<ButtonWithCustomIdOptions, 'label' | 'emoji'>>(
                () => ({ label: `${index}` }),
                emoji => ({ emoji }),
              ),
            ),
          }),
        ),
        MessageComponent.row,
      ),
    ],
  }
}

const detail = (answers: NonEmptyArray<ChoiceWithResponses>): BaseMessageOptions => ({
  embeds: pipe(
    answers,
    NonEmptyArray.mapWithIndex((index, { responses }) =>
      MessageComponent.safeEmbed({
        description: `${pipe(
          getEmoji(index),
          Maybe.getOrElse(() => `${index}`),
        )}${splitWith}${pipe(
          responses,
          List.sort(DiscordUserId.Ord),
          List.map(id => `<@${DiscordUserId.unwrap(id)}>`),
          List.mkString(', '),
        )}`,
        color: constants.messagesColor,
      }),
    ),
    NonEmptyArray.asMutable,
  ),
})

export const PollMessage = { poll, detail }

// What one block represents
const blockUnit = Math.round(100 / pollGraphWidth)

const graphBar = (votesCount: number, total: number): string => {
  const percents = total === 0 ? 0 : Math.round((votesCount / total) * 100)
  const blocks = '█'.repeat(blocksCount(percents))
  return `${blocks}${blocks === '' ? '' : '  '}${percents}% (${votesCount})`
}

const blocksCount = (percents: number): number => {
  const remainder = percents % blockUnit
  return remainder < blockUnit / 2
    ? Math.floor(percents / blockUnit)
    : Math.ceil(percents / blockUnit)
}
