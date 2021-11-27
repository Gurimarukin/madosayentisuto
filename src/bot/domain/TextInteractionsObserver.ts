import { MessageEmbed } from 'discord.js'
import type {
  DMChannel,
  Message,
  MessageOptions,
  MessagePayload,
  NewsChannel,
  PartialDMChannel,
  TextChannel,
  ThreadChannel,
} from 'discord.js'
import { string } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { List } from '../../shared/utils/fp'
import { Future } from '../../shared/utils/fp'

import type { CaptainConfig } from '../Config'
import { DiscordConnector } from '../helpers/DiscordConnector'
import type { MadEventMessageCreate } from '../models/events/MadEvent'
import type { TObserver } from '../models/rx/TObserver'

type MyChannel = PartialDMChannel | DMChannel | TextChannel | NewsChannel | ThreadChannel

export const TextInteractionsObserver = (
  config: CaptainConfig,
  discord: DiscordConnector,
): TObserver<MadEventMessageCreate> => {
  return {
    next: event => {
      const message = event.message

      if (message.author.id === discord.client.user.id) return Future.unit

      const cleanedWords = cleanMessage(message.content)

      if (containsVolAndPlagiat(cleanedWords)) return sendIDontLikeThieves(message.channel)

      if (isMentioned(message, cleanedWords)) return reactToMention(message, cleanedWords)

      return Future.unit
    },
  }

  function reactToMention(message: Message, cleanedWords: List<string>): Future<void> {
    if (containsThanks(cleanedWords)) return sendNoNeedToThankMe(message.channel)

    return Future.unit
  }

  function isMentioned(message: Message, cleanedWords: List<string>): boolean {
    const botId = discord.client.user.id
    return (
      message.mentions.roles.some(r => r.members.has(botId)) ||
      message.mentions.users.has(botId) ||
      containsMention(cleanedWords)
    )
  }

  function containsMention(message: List<string>): boolean {
    return pipe(
      config.mentions,
      List.some(mention => List.elem(string.Eq)(mention, message)),
    )
  }

  function containsVolAndPlagiat(message: List<string>): boolean {
    return List.elem(string.Eq)('vol', message) && List.elem(string.Eq)('plagiat', message)
  }

  function containsThanks(message: List<string>): boolean {
    return pipe(
      config.thanks,
      List.some(thank => List.elem(string.Eq)(thank, message)),
    )
  }
}

const send =
  (message: string | MessagePayload | MessageOptions) =>
  (channel: MyChannel): Future<void> =>
    pipe(
      DiscordConnector.sendMessage(channel, message),
      Future.map(() => {}),
    )

const sendIDontLikeThieves = send({
  embeds: [
    new MessageEmbed()
      .setTitle("J'aime pas trop les voleurs et les fils de pute.")
      .setURL('http://george-abitbol.fr/v/374a915e'),
  ],
})
const sendNoNeedToThankMe = send('Haha ! Inutile de me remercier...')

const cleanMessage = (message: string): List<string> =>
  message
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9_]/)
