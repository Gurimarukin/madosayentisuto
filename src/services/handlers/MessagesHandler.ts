import { Message, Guild } from 'discord.js'

import { DiscordConnector } from '../DiscordConnector'
import { PartialLogger } from '../Logger'
import { GuildStateService } from '../GuildStateService'
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
  guildStateService: GuildStateService
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

      return Maybe.some(
        isAdmin
          ? parseCommand(message, StringUtils.splitWords(rawCmd), cli.adminTextChannel)
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
        Maybe.fold<Guild, Future<unknown>>(
          () => Future.unit,
          guild => {
            switch (cmd._tag) {
              case 'CallsInit':
                return pipe(
                  deleteMessage(message),
                  Future.chain(() =>
                    discord.sendPrettyMessage(
                      message.channel,
                      StringUtils.stripMargins(
                        `Haha !
                        |Tu peux t'abonner aux appels sur ce serveur en réagissant avec :bell: !`
                      )
                    )
                  ),
                  Future.chain(
                    Maybe.fold<Message, Future<unknown>>(
                      () =>
                        discord.sendPrettyMessage(
                          message.author,
                          "Impossible d'envoyer un message dans ce salon."
                        ),
                      message =>
                        pipe(
                          discord.reactMessage(message, '🔔'),
                          Future.chain(_ => guildStateService.setCallsMessage(guild, message))
                        )
                    )
                  )
                )

              case 'DefaultRoleGet':
                return pipe(
                  deleteMessage(message),
                  Future.chain(_ => guildStateService.getDefaultRole(guild)),
                  Future.map(
                    Maybe.fold(
                      () => "Il n'y a aucun rôle par défaut pour ce serveur.",
                      _ => `Le rôle par défaut pour ce serveur est **@${_.name}**.`
                    )
                  ),
                  Future.chain(_ => discord.sendPrettyMessage(message.author, _))
                )

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
