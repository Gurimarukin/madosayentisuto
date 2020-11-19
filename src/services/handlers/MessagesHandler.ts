import { Guild, Message } from 'discord.js'
import { parse } from 'shell-quote'

import { Cli } from '../../commands/Cli'
import { Commands } from '../../commands/Commands'
import { Config } from '../../config/Config'
import { Command } from '../../decline/Command'
import { TSnowflake } from '../../models/TSnowflake'
import { ChannelUtils } from '../../utils/ChannelUtils'
import { Either, Future, List, Maybe, NonEmptyArray, pipe } from '../../utils/fp'
import { LogUtils } from '../../utils/LogUtils'
import { StringUtils } from '../../utils/StringUtils'
import { DiscordConnector } from '../DiscordConnector'
import { PartialLogger } from '../Logger'
import { CommandsHandler } from './CommandsHandler'

const MENTIONS = ['jean', 'plank', 'capitaine']
const THANKS = ['merci', 'remercie', 'remercier', 'remerciement', 'remerciements']

export const MessagesHandler = (
  Logger: PartialLogger,
  config: Config,
  cli: Cli,
  discord: DiscordConnector,
  commandsHandler: CommandsHandler
): ((message: Message) => Future<unknown>) => {
  const logger = Logger('MessagesHandler')

  return message =>
    message.author.bot
      ? Future.unit
      : pipe(
          LogUtils.withAuthor(logger, 'debug', message)(message.content),
          Future.fromIOEither,
          Future.chain(_ => handleMessage(message))
        )

  function handleMessage(message: Message): Future<unknown> {
    return pipe(
      pong(message),
      Maybe.alt(() => command(message)),
      Maybe.alt(() => reactToMention(message)),
      Maybe.getOrElse<Future<unknown>>(() => Future.unit)
    )
  }

  function pong(message: Message): Maybe<Future<unknown>> {
    return message.content.trim() === 'ping'
      ? Maybe.some(discord.sendMessage(message.channel, 'pong'))
      : Maybe.none
  }

  function command(message: Message): Maybe<Future<unknown>> {
    return pipe(
      parse(message.content),
      List.filter(StringUtils.isString),
      NonEmptyArray.fromArray,
      Maybe.chain(([head, ...tail]) =>
        pipe(
          Maybe.some(head),
          Maybe.filter(_ => _ === config.cmdPrefix),
          Maybe.chain(_ => handleCommandWithRights(message, tail))
        )
      )
    )
  }

  function handleCommandWithRights(message: Message, args: string[]): Maybe<Future<unknown>> {
    if (ChannelUtils.isDm(message.channel)) return Maybe.none

    const authorId = TSnowflake.wrap(message.author.id)
    const isAdmin = pipe(
      config.admins,
      List.exists(_ => _ === authorId)
    )

    return Maybe.some(
      isAdmin
        ? parseCommand(message, args, cli.adminTextChannel)
        : parseCommand(message, args, cli.userTextChannel)
    )
  }

  function deleteMessage(message: Message): Future<void> {
    return pipe(
      discord.deleteMessage(message),
      Future.chain(deleted =>
        deleted
          ? Future.unit
          : Future.fromIOEither(
              LogUtils.withAuthor(
                logger,
                'info',
                message
              )('Not enough permissions to delete message')
            )
      )
    )
  }

  function parseCommand(message: Message, args: string[], cmd: Command<Commands>): Future<unknown> {
    return pipe(
      cmd,
      Command.parse(args),
      Either.fold(
        e =>
          pipe(
            deleteMessage(message),
            Future.chain(_ =>
              discord.sendPrettyMessage(
                message.author,
                StringUtils.stripMargins(
                  `Command invalide: \`${message.content}\`
                  |\`\`\`
                  |${e}
                  |\`\`\``
                )
              )
            )
          ),
        runCommand(message)
      )
    )
  }

  function runCommand(message: Message): (cmd: Commands) => Future<unknown> {
    return cmd =>
      pipe(
        Maybe.fromNullable(message.guild),
        Maybe.fold<Guild, Future<unknown>>(() => Future.unit, commandsHandler(message, cmd))
      )
  }

  function reactToMention(message: Message): Maybe<Future<unknown>> {
    const cleanedWords = cleanMessage(message.content)
    const isMentioned =
      pipe(
        discord.clientUser,
        Maybe.exists(
          u =>
            message.mentions.roles.some(r => r.members.has(u.id)) ||
            message.mentions.users.has(u.id)
        )
      ) || containsMention(cleanedWords)
    const isThanks = containsThanks(cleanedWords)

    return isMentioned && isThanks ? Maybe.some(answerNoNeedToThankMe(message)) : Maybe.none
  }

  function containsMention(message: string[]): boolean {
    return [config.cmdPrefix, ...MENTIONS].some(w => message.includes(w))
  }

  function answerNoNeedToThankMe(message: Message): Future<unknown> {
    return pipe(
      discord.sendMessage(message.channel, 'Haha ! Inutile de me remercier...'),
      Future.chain(
        Maybe.fold<Message, Future<unknown>>(
          () =>
            discord.sendPrettyMessage(
              message.author,
              'En fait, je ne peux pas envoyer de messages dans ce salon.'
            ),
          _ => Future.unit
        )
      )
    )
  }
}

function containsThanks(message: string[]): boolean {
  return THANKS.some(w => message.includes(w))
}

function cleanMessage(message: string): string[] {
  return message
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9_]/)
}
