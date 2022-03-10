import { MessageActionRow, MessageButton } from 'discord.js'
import type { MessageOptions, User } from 'discord.js'
import { pipe } from 'fp-ts/function'

import { ValidatedNea } from '../../../shared/models/ValidatedNea'
import { StringUtils } from '../../../shared/utils/StringUtils'
import { Either, List, NonEmptyArray } from '../../../shared/utils/fp'

import { Colors, constants } from '../../constants'
import { PollButton } from '../../models/PollButton'
import type { TSnowflake } from '../../models/TSnowflake'
import { MessageUtils } from '../../utils/MessageUtils'

export type Answer = {
  readonly emoji: string
  readonly answer: string
  readonly votesCount: number
}

type FromIndex = {
  readonly answer: string
  readonly emojiIndex: number
  readonly votesCount: number
}

const fromIndex = ({ answer, emojiIndex, votesCount }: FromIndex): ValidatedNea<string, Answer> =>
  pipe(
    getEmoji(emojiIndex),
    Either.map(emoji => ({ emoji, answer, votesCount })),
  )

export const Answer = { fromIndex }

const graphWidth = 20 // chars

const base = (question: string, answers: NonEmptyArray<Answer>, author: User): MessageOptions => {
  const total = pipe(
    answers,
    List.reduce(0, (acc, a) => acc + a.votesCount),
  )

  const answersStr = pipe(
    answers,
    NonEmptyArray.map(({ emoji, answer, votesCount }) =>
      StringUtils.stripMargins(
        `${emoji}  ${answer}
        |  ${graphBar(votesCount, total)}`,
      ),
    ),
    StringUtils.mkString('\n\n'),
  )

  return {
    embeds: [
      MessageUtils.safeEmbed({
        title: question,
        description: StringUtils.stripMargins(
          `${answersStr}
          |
          |Total de réponses : ${total}
          |*Sondage créé par ${author}*`,
        ),
        color: Colors.darkred,
      }),
    ],
  }
}

// What one block represents
const blockUnit = Math.round(100 / graphWidth)

// ▀ UPPER HALF BLOCK
// ▁ LOWER ONE EIGHTH BLOCK
// ▂ LOWER ONE QUARTER BLOCK
// ▃ LOWER THREE EIGHTHS BLOCK
// ▄ LOWER HALF BLOCK
// ▅ LOWER FIVE EIGHTHS BLOCK
// ▆ LOWER THREE QUARTERS BLOCK
// ▇ LOWER SEVEN EIGHTHS BLOCK
// █ FULL BLOCK
const blockChar = '█'

// │ LIGHT VERTICAL
// ┃ HEAVY VERTICAL

const graphBar = (votesCount: number, total: number): string => {
  const percents = total === 0 ? 0 : Math.round((votesCount / total) * 100)
  const blocks = blockChar.repeat(blocksCount(percents))
  return `┃${blocks} ${percents}% (${votesCount})`
}

const blocksCount = (percents: number): number => {
  const remainder = percents % blockUnit
  return remainder < blockUnit / 2
    ? Math.floor(percents / blockUnit)
    : Math.ceil(percents / blockUnit)
}

const withButtons = (
  messageId: TSnowflake,
  question: string,
  answers: NonEmptyArray<Answer>,
  author: User,
): MessageOptions => ({
  ...base(question, answers, author),
  components: [
    new MessageActionRow().addComponents(
      ...pipe(
        answers,
        List.mapWithIndex((i, { emoji, answer }) =>
          new MessageButton()
            .setCustomId(PollButton.format(PollButton.of(messageId, i)))
            .setLabel(answer)
            .setStyle('SECONDARY')
            .setEmoji(emoji),
        ),
      ),
    ),
  ],
})

export const pollMessage = { base, withButtons }

type EmojiKey = keyof typeof constants.emojis.characters

const emojis = pipe(
  NonEmptyArray.range(97, 122),
  NonEmptyArray.map(i => constants.emojis.characters[String.fromCharCode(i) as EmojiKey]),
)

const getEmoji = (i: number): ValidatedNea<string, string> =>
  pipe(
    emojis,
    List.lookup(i),
    ValidatedNea.fromOption(() => `Couldn't find emoji with index ${i}`),
  )
