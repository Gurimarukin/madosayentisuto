import { MessageActionRow, MessageButton } from 'discord.js'
import type { Message, MessageOptions } from 'discord.js'
import { apply, string } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'

import { ValidatedNea } from '../../../shared/models/ValidatedNea'
import { StringUtils } from '../../../shared/utils/StringUtils'
import { Either, List, Maybe, NonEmptyArray } from '../../../shared/utils/fp'

import { Colors, constants } from '../../constants'
import { PollButton } from '../../models/PollButton'
import { MessageUtils } from '../../utils/MessageUtils'

const graphWidth = 20 // chars

// emojis

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

// Answer

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

// format

const splitWith = '  '

type Format = {
  readonly question: string
  readonly answers: NonEmptyArray<Answer>
  readonly author: string
}

const format = ({ question, answers, author }: Format): MessageOptions => {
  const total = pipe(
    answers,
    List.reduce(0, (acc, a) => acc + a.votesCount),
  )

  const answersStr = pipe(
    answers,
    NonEmptyArray.map(({ emoji, answer, votesCount }) =>
      StringUtils.stripMargins(
        `${emoji}${splitWith}${answer}
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
    components: [
      new MessageActionRow().addComponents(
        ...pipe(
          answers,
          List.mapWithIndex((i, { emoji, answer }) =>
            new MessageButton()
              .setCustomId(PollButton.format(PollButton.of(i)))
              .setLabel(answer)
              .setStyle('SECONDARY')
              .setEmoji(emoji),
          ),
        ),
      ),
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
  return `┃${blocks}  ${percents}% (${votesCount})`
}

const blocksCount = (percents: number): number => {
  const remainder = percents % blockUnit
  return remainder < blockUnit / 2
    ? Math.floor(percents / blockUnit)
    : Math.ceil(percents / blockUnit)
}

// parse

type ParseResult = {
  readonly question: string
  readonly answers: NonEmptyArray<EmojiWithAnswer>
  readonly author: string
}

export type EmojiWithAnswer = {
  readonly emoji: string
  readonly answer: string
}

const parse = (message: Message): Maybe<ParseResult> =>
  pipe(
    message.embeds,
    List.lookup(0),
    Maybe.chain(embed =>
      apply.sequenceS(Maybe.Apply)({
        question: Maybe.fromNullable(embed.title),
        description: parseDescription(embed.description),
      }),
    ),
    Maybe.map(
      ({ question, description: { answers, author } }): ParseResult => ({
        question,
        answers,
        author,
      }),
    ),
  )

type DescriptionParseResult = {
  readonly answers: NonEmptyArray<EmojiWithAnswer>
  readonly author: string
}

const parseDescription = (description: string | null): Maybe<DescriptionParseResult> => {
  if (description === null) return Maybe.none

  const lines = pipe(description, string.split('\n'))

  return apply.sequenceS(Maybe.Apply)({
    author: pipe(
      List.last(lines),
      Maybe.map(last => last.slice(18, -1)),
    ),
    answers: pipe(
      lines,
      List.dropRight(3),
      List.chunksOf(3),
      List.traverse(Maybe.Applicative)(
        flow(NonEmptyArray.head, line => {
          const [emoji, tail] = pipe(line, string.split(splitWith), NonEmptyArray.unprepend)

          if (!List.isNonEmpty(tail)) return Maybe.none

          const answer = pipe(tail, StringUtils.mkString(splitWith))

          return Maybe.some<EmojiWithAnswer>({ emoji, answer })
        }),
      ),
      Maybe.chain(NonEmptyArray.fromReadonlyArray),
    ),
  })
}

export const pollMessage = { format, parse }
