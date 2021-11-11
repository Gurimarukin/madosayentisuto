import type { Message } from 'discord.js'
import { pipe } from 'fp-ts/function'

import type { List } from '../../shared/utils/fp'
import { Future, Maybe } from '../../shared/utils/fp'

import type { CaptainConfig } from '../Config'
import { DiscordConnector } from '../helpers/DiscordConnector'
import type { MadEventMessageCreate } from '../models/events/MadEvent'
import type { TObserver } from '../models/rx/TObserver'

export const ThanksCaptainObserver = (
  config: CaptainConfig,
  discord: DiscordConnector,
): TObserver<MadEventMessageCreate> => {
  return {
    next: event => {
      const message = event.message

      if (message.author.id === discord.client.user.id) return Future.unit

      return pipe(
        reactToMention(message),
        Maybe.getOrElseW(() => Future.unit),
      )
    },
  }

  function reactToMention(message: Message): Maybe<Future<void>> {
    const cleanedWords = cleanMessage(message.content)

    const botId = discord.client.user.id
    const isMentioned =
      message.mentions.roles.some(r => r.members.has(botId)) ||
      message.mentions.users.has(botId) ||
      containsMention(cleanedWords)

    const isThanks = containsThanks(cleanedWords)

    return isMentioned && isThanks ? Maybe.some(answerNoNeedToThankMe(message)) : Maybe.none
  }

  function containsMention(message: List<string>): boolean {
    return config.mentions.some(w => message.includes(w))
  }

  function containsThanks(message: List<string>): boolean {
    return config.thanks.some(w => message.includes(w))
  }
}

const answerNoNeedToThankMe = (message: Message): Future<void> =>
  pipe(
    DiscordConnector.sendMessage(message.channel, 'Haha ! Inutile de me remercier...'),
    Future.map(
      Maybe.fold(
        () => {}, // TODO: what if message wasn't sent?
        () => {},
      ),
    ),
  )

const cleanMessage = (message: string): List<string> =>
  message
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9_]/)
