import { Message, Guild } from 'discord.js'

import { DiscordConnector } from '../DiscordConnector'
import { PartialLogger } from '../Logger'
import { GuildStateService } from '../GuildStateService'
import { Cli } from '../../commands/Cli'
import { Command } from '../../commands/Command'
import { Commands } from '../../commands/Commands'
import { CommandWithPrefix } from '../../commands/CommandWithPrefix'
import { Config } from '../../config/Config'
import { TSnowflake } from '../../models/TSnowflake'
import { IO, Maybe, pipe, Future, List, Either } from '../../utils/fp'
import { ChannelUtils } from '../../utils/ChannelUtils'
import { StringUtils } from '../../utils/StringUtils'

export const MessagesHandler = (
  Logger: PartialLogger,
  config: Config,
  discord: DiscordConnector,
  guildStateService: GuildStateService
): ((message: Message) => Future<unknown>) => {
  const logger = Logger('MessagesHandler')

  const regex = new RegExp(`^\\s*${config.cmdPrefix}(.*)$`, 'm')

  return message =>
    discord.isSelf(message.author)
      ? Future.unit
      : pipe(
          logMessage(message),
          Future.fromIOEither,
          Future.chain(_ => handleMessage(message))
        )

  function logMessage(message: Message): IO<void> {
    return logger.debug(
      [
        ...pipe(
          Maybe.fromNullable(message.guild),
          Maybe.fold(
            () => [],
            _ =>
              pipe(
                List.cons(_.name, message.channel.type === 'text' ? [message.channel.name] : []),
                _ => [`[${_.join(' #')}]`]
              )
          )
        ),
        `${message.author.username}:`,
        message.content
      ].join(' ')
    )
  }

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

      return Maybe.some(
        isAdmin
          ? parseCommand(message, StringUtils.splitWords(rawCmd), Cli.adminTextChannel)
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
  }

  function deleteMessage(message: Message): Future<void> {
    return pipe(
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
      )
    )
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
        Maybe.fold<Guild, Future<unknown>>(
          () => Future.unit,
          guild => {
            switch (cmd._tag) {
              case 'DefaultRoleSet':
                return pipe(
                  deleteMessage(message),
                  Future.chain(_ => discord.fetchRole(guild, cmd.role)),
                  Future.chain(
                    Maybe.fold(
                      () =>
                        discord.sendPrettyMessage(
                          message.author,
                          `**${cmd.role}** n'est pas un rôle valide.`
                        ),
                      role =>
                        pipe(
                          guildStateService.setDefaultRole(guild, role),
                          Future.chain(success =>
                            success
                              ? discord.sendPrettyMessage(
                                  message.channel,
                                  `**@${role.name}** est maintenant le rôle par défaut.`
                                )
                              : discord.sendPrettyMessage(
                                  message.author,
                                  "Erreur lors de l'exécution de la commande"
                                )
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
}
