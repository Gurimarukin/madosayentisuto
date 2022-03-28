import { MessageActionRow, MessageButton } from 'discord.js'
import type { MessageOptions } from 'discord.js'
import { pipe } from 'fp-ts/function'

import { UserId } from '../../../shared/models/guild/UserId'
import { StringUtils } from '../../../shared/utils/StringUtils'
import { List, Maybe, NonEmptyArray } from '../../../shared/utils/fp'

import { constants } from '../../constants'
import type { ChoiceWithVotesCount } from '../../models/poll/ChoiceWithVotesCount'
import { PollButton } from '../../models/poll/PollButton'
import { MessageUtils } from '../../utils/MessageUtils'

// emojis

type EmojiKey = keyof typeof constants.emojis.characters

const emojis = pipe(
  NonEmptyArray.range(97, 122), // [97-122]: [a-z]
  NonEmptyArray.map(i => constants.emojis.characters[String.fromCharCode(i) as EmojiKey]),
)

const getEmoji = (i: number): Maybe<string> => List.lookup(i, emojis)

// format

const splitWith = '  '

type IsMultiple = {
  readonly isMultiple: boolean
}

export const pollMessage = (
  createdBy: UserId,
  question: string,
  answers: NonEmptyArray<ChoiceWithVotesCount>,
  { isMultiple }: IsMultiple,
): MessageOptions => {
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
          |*Sondage créé par <@${UserId.unwrap(
            createdBy,
          )}>* - choix multiple : \`${StringUtils.booleanLabel(isMultiple).toLowerCase()}\``,
        ),
        color: constants.messagesColor,
      }),
    ],
    components: [
      new MessageActionRow().addComponents(
        ...pipe(
          answers,
          List.mapWithIndex(index => {
            const res = new MessageButton()
              .setCustomId(PollButton.format(PollButton.of(index)))
              .setStyle('SECONDARY')

            return pipe(
              getEmoji(index),
              Maybe.fold(
                () => res.setLabel(`${index}`),
                emoji => res.setEmoji(emoji),
              ),
            )
          }),
        ),
      ),
    ],
  }
}

// What one block represents
const blockUnit = Math.round(100 / constants.pollGraphWidth)

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
