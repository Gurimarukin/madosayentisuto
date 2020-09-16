import { Guild, Message, MessageAttachment, Role, TextChannel } from 'discord.js'
import { sequenceT } from 'fp-ts/lib/Apply'

import { Commands } from '../../commands/Commands'
import { callsEmoji } from '../../global'
import { Calls } from '../../models/guildState/Calls'
import { TSnowflake } from '../../models/TSnowflake'
import { ValidatedNea } from '../../models/ValidatedNea'
import { ChannelUtils } from '../../utils/ChannelUtils'
import { Dict, Either, Future, Maybe, NonEmptyArray, flow, pipe } from '../../utils/fp'
import { LogUtils } from '../../utils/LogUtils'
import { StringUtils } from '../../utils/StringUtils'
import { ActivityService } from '../ActivityService'
import { DiscordConnector } from '../DiscordConnector'
import { GuildStateService } from '../GuildStateService'
import { PartialLogger } from '../Logger'

const images: Dict<string> = {
  mefian: 'https://imgur.com/a/9umwDvt'
}

export const CommandsHandler = (
  Logger: PartialLogger,
  discord: DiscordConnector,
  activityService: ActivityService,
  guildStateService: GuildStateService
) => {
  const logger = Logger('CommandsHandler')

  return (message: Message, command: Commands) => (guild: Guild): Future<unknown> => {
    switch (command._tag) {
      // calls
      case 'CallsInit':
        return pipe(
          Future.parallel<unknown>([
            deleteMessage(message),
            pipe(
              fetchChannelAndRole(guild, command.channel, command.role),
              Future.chain(
                Either.fold(
                  flow(StringUtils.mkString('\n'), _ =>
                    discord.sendPrettyMessage(message.author, _)
                  ),
                  ([channel, role]) => callsInit(message, guild, channel, role)
                )
              )
            )
          ])
        )

      // defaultRole
      case 'DefaultRoleGet':
        return Future.parallel<unknown>([
          deleteMessage(message),
          pipe(
            guildStateService.getDefaultRole(guild),
            Future.map(
              Maybe.fold(
                () => "Il n'y a aucun rôle par défaut pour ce serveur.",
                _ => `Le rôle par défaut pour ce serveur est **@${_.name}**.`
              )
            ),
            Future.chain(_ => discord.sendPrettyMessage(message.author, _))
          )
        ])

      case 'DefaultRoleSet':
        return pipe(
          deleteMessage(message),
          Future.chain(_ => discord.fetchRole(guild, command.role)),
          Future.chain(
            Maybe.fold(
              () =>
                discord.sendPrettyMessage(
                  message.author,
                  `**${command.role}** n'est pas un rôle valide.`
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

      case 'Say':
        return pipe(
          deleteMessage(message),
          Future.chain(_ =>
            discord.sendMessage(
              message.channel,
              command.message,
              command.attachments.map(_ => new MessageAttachment(_))
            )
          ),
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

      case 'ActivityGet':
        return pipe(
          deleteMessage(message),
          Future.chain(_ => activityService.getActivity()),
          Future.chain(_ =>
            discord.sendPrettyMessage(
              message.author,
              pipe(
                _,
                Maybe.fold(
                  () => 'Pas de statut',
                  _ =>
                    StringUtils.stripMargins(
                      `Statut
                      |\`\`\`
                      |${JSON.stringify(_, null, 2)}
                      |\`\`\``
                    )
                )
              )
            )
          )
        )

      case 'ActivityUnset':
        return activityService.unsetActivity()

      case 'ActivitySet':
        return activityService.setActivity(command.activity)

      case 'ActivityRefresh':
        return pipe(
          deleteMessage(message),
          Future.chain(_ => activityService.setActivityFromPersistence())
        )

      case 'Image':
        return pipe(
          images,
          Dict.lookup(command.value),
          Maybe.fold<string, Future<unknown>>(
            () => Future.unit,
            image => discord.sendMessage(message.channel, image)
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

  function fetchChannelAndRole(
    guild: Guild,
    channel: TSnowflake,
    role: TSnowflake
  ): Future<ValidatedNea<string, [TextChannel, Role]>> {
    return pipe(
      sequenceT(Future.taskEitherSeq)(
        pipe(discord.fetchChannel(channel), Future.map(Maybe.filter(ChannelUtils.isText))),
        discord.fetchRole(guild, role)
      ),
      Future.map(([c, r]) =>
        sequenceT(Either.getValidation(NonEmptyArray.getSemigroup<string>()))(
          fromOption(c, `Channel not found: <#${channel}>`),
          fromOption(r, `Role not found: <@${role}>`)
        )
      )
    )
  }

  function callsInit(message: Message, guild: Guild, channel: TextChannel, role: Role) {
    return pipe(
      discord.sendPrettyMessage(
        message.channel,
        StringUtils.stripMargins(
          `Yoho, ${role} !
          |
          |Tu peux t'abonner aux appels sur ce serveur en réagissant avec ${callsEmoji}  !
          |Ils seront notifiés dans ${channel}.`
        )
      ),
      Future.chain(
        Maybe.fold<Message, Future<unknown>>(
          () =>
            discord.sendPrettyMessage(
              message.author,
              ChannelUtils.isDm(message.channel)
                ? `Impossible d'envoyer le message d'abonnement dans ce salon.`
                : `Impossible d'envoyer le message d'abonnement dans le salon **#${message.channel.name}**.`
            ),
          message =>
            Future.parallel<unknown>([
              discord.reactMessage(message, callsEmoji),
              pipe(
                guildStateService.getCalls(guild),
                Future.chain(
                  Maybe.fold(
                    () => Future.unit,
                    previous => deleteMessage(previous.message)
                  )
                ),
                Future.chain(_ => guildStateService.setCalls(guild, Calls(message, channel, role)))
              )
            ])
        )
      )
    )
  }
}

export type CommandsHandler = ReturnType<typeof CommandsHandler>

function fromOption<E, A>(ma: Maybe<A>, e: E): ValidatedNea<E, A> {
  return pipe(
    ma,
    ValidatedNea.fromOption(() => e)
  )
}
