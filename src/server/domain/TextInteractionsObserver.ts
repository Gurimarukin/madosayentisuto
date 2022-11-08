import type {
  DMChannel,
  Message,
  MessageCreateOptions,
  MessagePayload,
  NewsChannel,
  PartialDMChannel,
  TextChannel,
  ThreadChannel,
  VoiceChannel,
} from 'discord.js'
import { string } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { ObserverWithRefinement } from '../../shared/models/rx/ObserverWithRefinement'
import { StringUtils } from '../../shared/utils/StringUtils'
import type { NotUsed } from '../../shared/utils/fp'
import { Future, List, toNotUsed } from '../../shared/utils/fp'

import type { CaptainConfig } from '../config/Config'
import { constants } from '../config/constants'
import { DiscordConnector } from '../helpers/DiscordConnector'
import { MessageComponent } from '../models/discord/MessageComponent'
import { MadEvent } from '../models/event/MadEvent'

type MyChannel =
  | DMChannel
  | PartialDMChannel
  | NewsChannel
  | TextChannel
  | ThreadChannel
  | VoiceChannel

// 'vol' & 'plagiat'
// mention & thanks

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const TextInteractionsObserver = (config: CaptainConfig, discord: DiscordConnector) => {
  return ObserverWithRefinement.fromNext(
    MadEvent,
    'MessageCreate',
  )(event => {
    const message = event.message

    if (message.author.id === discord.client.user.id) return Future.notUsed

    const cleanedWords = cleanMessage(message.content)

    if (containsVolAndPlagiat(cleanedWords)) return sendIDontLikeThieves(message.channel)

    if (isMentioned(message, cleanedWords)) return reactToMention(message, cleanedWords)

    return Future.notUsed
  })

  function containsVolAndPlagiat(message: List<string>): boolean {
    return List.elem(string.Eq)('vol', message) && List.elem(string.Eq)('plagiat', message)
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

  function reactToMention(message: Message, cleanedWords: List<string>): Future<NotUsed> {
    if (containsThanks(cleanedWords)) return sendNoNeedToThankMe(message.channel)

    return Future.notUsed
  }

  function containsThanks(message: List<string>): boolean {
    return pipe(
      config.thanks,
      List.some(thank => List.elem(string.Eq)(thank, message)),
    )
  }
}

const sendMessage =
  (message: string | MessagePayload | MessageCreateOptions) =>
  (channel: MyChannel): Future<NotUsed> =>
    pipe(DiscordConnector.sendMessage(channel, message), Future.map(toNotUsed))

const sendIDontLikeThieves = sendMessage(
  MessageComponent.singleSafeEmbed({
    title: "J'aime pas trop les voleurs et les fils de pute.",
    url: 'http://george-abitbol.fr/v/374a915e',
    color: constants.messagesColor,
  }),
)
const sendNoNeedToThankMe = sendMessage('Haha ! Inutile de me remercier...')

const cleanMessage = (message: string): List<string> =>
  pipe(
    message,
    string.trim,
    StringUtils.cleanUTF8ToASCII,
    string.toLowerCase,
    string.split(/[^a-z0-9_]/),
  )
