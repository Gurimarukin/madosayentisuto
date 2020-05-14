import { Message, Guild } from 'discord.js'

import { CommandsHandler } from './CommandsHandler'
import { DiscordConnector } from '../DiscordConnector'
import { PartialLogger } from '../Logger'
import { Cli } from '../../commands/Cli'
import { Command } from '../../commands/Command'
import { Commands } from '../../commands/Commands'
import { Config } from '../../config/Config'
import { TSnowflake } from '../../models/TSnowflake'
import { Maybe, pipe, Future, List, Either } from '../../utils/fp'
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

  const regex = new RegExp(`^\\s*${config.cmdPrefix}(.*)$`, 'm')

  return message =>
    discord.isSelf(message.author)
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
    return pipe(withoutPrefix(message.content), Maybe.chain(handleCommandWithRights(message)))
  }

  function withoutPrefix(msg: string): Maybe<string> {
    return pipe(
      Maybe.fromNullable(msg.match(regex)),
      Maybe.chain(_ => List.lookup(1, _))
    )
  }

  function handleCommandWithRights(message: Message): (rawCmd: string) => Maybe<Future<unknown>> {
    return rawCmd => {
      if (ChannelUtils.isDm(message.channel)) return Maybe.none

      const authorId = TSnowflake.wrap(message.author.id)
      const isAdmin = pipe(
        config.admins,
        List.exists(_ => _ === authorId)
      )

      const args = StringUtils.splitWords(rawCmd)

      return Maybe.some(
        isAdmin
          ? parseCommand(message, args, cli.adminTextChannel)
          : parseCommand(message, args, cli.simpleUserTextChannel)
      )
    }
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
