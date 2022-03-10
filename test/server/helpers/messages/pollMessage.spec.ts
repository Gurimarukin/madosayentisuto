import type { Message } from 'discord.js'

import { Maybe } from '../../../../src/shared/utils/fp'

import { pollMessage } from '../../../../src/server/helpers/messages/pollMessage'

describe('pollButton', () => {
  it('should parse after format', () => {
    const question = ' qsdff qsde  " '

    const emoji1 = ':emoji-1:'
    const answerA = 'Answer A'

    const emoji2 = ':emoji-2:'
    const answerB = 'Answer   B'

    const author = '<@Grimalkin>'

    const formatted = pollMessage.format({
      question,
      answers: [
        { emoji: emoji1, answer: answerA, votesCount: 0 },
        { emoji: emoji2, answer: answerB, votesCount: 0 },
      ],
      author,
    })

    expect(pollMessage.parse(formatted as unknown as Message)).toStrictEqual(
      Maybe.some({
        question,
        answers: [
          { emoji: emoji1, answer: answerA },
          { emoji: emoji2, answer: answerB },
        ],
        author,
      }),
    )
  })
})
