import { Message, Guild } from 'discord.js'
import { parse } from 'shell-quote'

import { CommandsHandler } from './CommandsHandler'
import { DiscordConnector } from '../DiscordConnector'
import { PartialLogger } from '../Logger'
import { Cli } from '../../commands/Cli'
import { Command } from '../../commands/Command'
import { Commands } from '../../commands/Commands'
import { Config } from '../../config/Config'
import { TSnowflake } from '../../models/TSnowflake'
import { Maybe, pipe, Future, List, Either, NonEmptyArray, inspect } from '../../utils/fp'
import { ChannelUtils } from '../../utils/ChannelUtils'
import { StringUtils } from '../../utils/StringUtils'
import { LogUtils } from '../../utils/LogUtils'

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
      inspect('parsed:'),
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
        : pipe(
            deleteMessage(message),
            Future.chain(_ =>
              discord.sendPrettyMessage(
                message.author,
                'Gibier de potence, tu ne peux pas faire ça !'
              )
            )
          )
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
}
