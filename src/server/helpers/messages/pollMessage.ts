import { MessageActionRow, MessageButton } from 'discord.js'
import type { MessageOptions, User } from 'discord.js'
import { string } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'

import { StringUtils } from '../../../shared/utils/StringUtils'
import type { Tuple } from '../../../shared/utils/fp'
import { List } from '../../../shared/utils/fp'
import { Maybe, NonEmptyArray } from '../../../shared/utils/fp'

import { Colors, constants } from '../../constants'
import { TSnowflake } from '../../models/TSnowflake'
import { MessageUtils } from '../../utils/MessageUtils'

export type Answer = {
  readonly emoji: string
  readonly answer: string
}

export const Answer = {
  of: (answer: string, i: number): Answer => ({ answer, emoji: getEmoji(i) }),
}

export const pollButton = {
  format: (messageId: TSnowflake, index: number) => `${TSnowflake.unwrap(messageId)}-${index}`,
  parse: (raw: string): Maybe<Tuple<TSnowflake, number>> => {
    const [rawMessageId, rawIndex, ...rest] = pipe(raw, string.split('-'))

    if (rawIndex === undefined || 0 < rest.length) return Maybe.none

    const index = Number(rawIndex)
    if (isNaN(index)) return Maybe.none

    return Maybe.some([TSnowflake.wrap(rawMessageId), index])
  },
}

const base = (question: string, answers: NonEmptyArray<Answer>, author: User): MessageOptions => ({
  embeds: [
    MessageUtils.safeEmbed({
      title: question,
      description: StringUtils.stripMargins(
        `${pipe(
          answers,
          NonEmptyArray.fromReadonlyArray,
          Maybe.map(
            flow(
              NonEmptyArray.map(({ emoji, answer }) => `${emoji}  ${answer}`),
              StringUtils.mkString('', '\n\n', '\n\n'),
            ),
          ),
          Maybe.getOrElse(() => ''),
        )}*Sondage créé par ${author}*`,
      ),
      color: Colors.darkred,
    }),
  ],
})

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
            .setCustomId(pollButton.format(messageId, i))
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
const getEmoji = (i: number): string => emojis[i] as string
