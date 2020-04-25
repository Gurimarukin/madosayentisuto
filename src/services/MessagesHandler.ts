import { Message, Guild } from 'discord.js'

import { DiscordConnector } from './DiscordConnector'
import { PartialLogger } from './Logger'
import { ReferentialService } from './ReferentialService'
import { Cli } from '../commands/Cli'
import { Command } from '../commands/Command'
import { Commands } from '../commands/Commands'
import { CommandWithPrefix } from '../commands/CommandWithPrefix'
import { Config } from '../config/Config'
import { TSnowflake } from '../models/TSnowflake'
import { Maybe, pipe, Future, List, Either, todo } from '../utils/fp'
import { MessageUtils } from '../utils/MessageUtils'
import { StringUtils } from '../utils/StringUtils'

export const MessagesHandler = (
  Logger: PartialLogger,
  config: Config,
  discord: DiscordConnector,
  referentialService: ReferentialService
): ((message: Message) => Future<unknown>) => {
  const logger = Logger('MessagesHandler')

  const regex = new RegExp(`^\\s*${config.cmdPrefix}(.*)$`, 'm')

  return message =>
    discord.isFromSelf(message)
      ? Future.unit
      : pipe(
          logger.debug(
            [
              ...pipe(
                Maybe.fromNullable(message.guild),
                Maybe.fold(
                  () => [],
                  _ =>
                    pipe(
                      List.cons(
                        _.name,
                        message.channel.type === 'text' ? [message.channel.name] : []
                      ),
                      _ => [`[${_.join(' #')}]`]
                    )
                )
              ),
              `${message.author.username}:`,
              message.content
            ].join(' ')
          ),
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

  function handleCommandWithRights(message: Message): (rawCmd: string) => Maybe<Future<unknown>> {
    return rawCmd => {
      const isDm = MessageUtils.isDm(message.channel)
      if (isDm) return Maybe.none

      const args = StringUtils.splitWords(rawCmd)
      const isAdmin = pipe(
        config.admins,
        List.exists(_ => _ === TSnowflake.wrap(message.author.id))
      )

      const res: Future<unknown> = isAdmin
        ? parseCommand(message, args, Cli.adminTextChannel)
        : discord.sendMessage(message.author, 'Gibier de potence, tu ne peux pas faire ça !')

      return Maybe.some(
        pipe(
          discord.deleteMessage(message),
          Future.chain(deleted =>
            deleted
              ? Future.unit
              : Future.fromIOEither(
                  logger.info(
                    `[${pipe(
                      Maybe.fromNullable(message.guild),
                      Maybe.fold(
                        () => message.author.username,
                        _ => _.name
                      )
                    )}]`,
                    'Not enough permissions to delete message '
                  )
                )
          ),
          Future.chain(_ => res)
        )
      )
    }
  }

  function parseCommand(
    message: Message,
    args: string[],
    cmd: (prefix: string) => CommandWithPrefix<Commands>
  ): Future<unknown> {
    return pipe(
      cmd(config.cmdPrefix),
      Command.parse(args),
      Either.fold(
        e =>
          discord.sendMessage(
            message.author,
            StringUtils.stripMargins(
              `Wrong command: \`${message.content}\`
              |\`\`\`
              |${e}
              |\`\`\``
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
        Maybe.fold<Guild, Future<unknown>>(
          () => Future.fromIOEither(logger.warn('Received "calls" command from non-guild channel')),
          guild => {
            switch (cmd._tag) {
              case 'CallsSubscribe':
                return pipe(
                  Future.right(referentialService.subscribeCalls(guild, message.channel)),
                  Future.chain(_ => discord.sendMessage(message.channel, 'Salon ajouté !'))
                )

              case 'CallsUnsubscribe':
                return todo()

              case 'CallsIgnore':
                return pipe(
                  Future.right(referentialService.ignoreCallsFrom(guild, cmd.user)),
                  Future.chain(_ => discord.fetchUser(cmd.user)),
                  Future.chain(_ =>
                    discord.sendMessage(
                      message.channel,
                      pipe(
                        _,
                        Maybe.fold(
                          () => "Gibier de potence ! Les appels de l'utilisateur seront ignorés.",
                          _ => `Gibier de potence ! Les appels de <@${_.id}> seront ignorés.`
                        )
                      )
                    )
                  )
                )
            }
          }
        )
      )
  }

  function withoutPrefix(msg: string): Maybe<string> {
    return pipe(
      Maybe.fromNullable(msg.match(regex)),
      Maybe.chain(_ => List.lookup(1, _))
    )
  }
}
