import { SlashCommandBuilder } from '@discordjs/builders'
import { APIInteractionDataResolvedChannel, APIRole, APIUser, ChannelType } from 'discord-api-types'
import {
  CommandInteraction,
  Guild,
  GuildChannel,
  Message,
  MessageActionRow,
  MessageButton,
  Role,
  TextBasedChannels,
  TextChannel,
  ThreadChannel,
  User,
} from 'discord.js'
import { apply } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { globalConfig } from '../../../globalConfig'
import { InteractionCreate } from '../../../models/MadEvent'
import { TObserver } from '../../../models/TObserver'
import { TSnowflake } from '../../../models/TSnowflake'
import { ChannelUtils } from '../../../utils/ChannelUtils'
import { Future, Maybe } from '../../../utils/fp'
import { LogUtils } from '../../../utils/LogUtils'
import { StringUtils } from '../../../utils/StringUtils'
import { DiscordConnector } from '../../DiscordConnector'
import { GuildStateService } from '../../GuildStateService'
import { PartialLogger } from '../../Logger'
import { callsButton } from '../CallsAutoroleObserver'

// DefaultRoleGet
// DefaultRoleSet
// Say
// ActivityGet
// ActivityUnset
// ActivitySet
// ActivityRefresh

const callsInitCommand = new SlashCommandBuilder()
  .setDefaultPermission(false)
  .setName('calls')
  .setDescription("Jean Plank n'est pas votre secrétaire mais gère vos appels")
  .addSubcommand(subcommand =>
    /**
     * Jean Plank envoie un message dans le salon où la commande a été effectuée.
     * Les membres d'équipage qui y réagissent avec 🔔 obtiennent le rôle <role>.
     * À la suite de quoi, lorsqu'un appel commence sur le serveur, ils seront notifiés dans le salon <channel> en étant mentionné par le rôle <role>.`
     */
    subcommand
      .setName('init')
      .setDescription(`Pour initier la gestion des appels`)
      .addChannelOption(option =>
        option
          .setName('channel')
          .addChannelTypes([ChannelType.GuildText])
          .setDescription('Le salon dans lequel les appels seront notifiés')
          .setRequired(true),
      )
      .addRoleOption(option =>
        option
          .setName('role')
          .setDescription('Le rôle qui sera notifié des appels')
          .setRequired(true),
      ),
  )

export const adminCommands = [callsInitCommand]

export const AdminCommandsObserver = (
  Logger: PartialLogger,
  discord: DiscordConnector,
  guildStateService: GuildStateService,
): TObserver<InteractionCreate> => {
  const logger = Logger('AdminCommandsObserver')

  return {
    next: event => {
      const interaction = event.interaction

      if (!interaction.isCommand()) return Future.unit

      if (interaction.commandName === 'calls') return onCalls(interaction)

      return Future.unit
    },
  }

  function onCalls(interaction: CommandInteraction): Future<void> {
    if (interaction.options.getSubcommand(false) === 'init') return onCallsInit(interaction)

    return Future.unit
  }

  function onCallsInit(interaction: CommandInteraction): Future<void> {
    const maybeGuild = Maybe.fromNullable(interaction.guild)
    return pipe(
      DiscordConnector.interactionReply(interaction, { ephemeral: true }),
      Future.chain(() =>
        pipe(
          apply.sequenceS(Future.ApplyPar)({
            guild: Future.right(maybeGuild),
            author: fetchUser(interaction.member.user),
            commandChannel: Future.right(Maybe.fromNullable(interaction.channel)),
            callsChannel: fetchChannel(
              Maybe.fromNullable(interaction.options.getChannel('channel')),
            ),
            role: fetchRole(maybeGuild, Maybe.fromNullable(interaction.options.getRole('role'))),
          }),
          Future.map(apply.sequenceS(Maybe.Apply)),
          Future.chain(
            Maybe.fold(
              () => Future.unit,
              ({ guild, author, commandChannel, callsChannel, role }) =>
                sendInitMessageAndUpdateState(guild, author, commandChannel, callsChannel, role),
            ),
          ),
        ),
      ),
    )
  }

  function sendInitMessageAndUpdateState(
    guild: Guild,
    author: User,
    commandChannel: TextBasedChannels,
    channel: TextChannel,
    role: Role,
  ): Future<void> {
    return pipe(
      sendInitMessage(commandChannel, channel, role),
      Future.chain(
        Maybe.fold(
          () =>
            ChannelUtils.isNamedChannel(commandChannel)
              ? pipe(
                  DiscordConnector.sendPrettyMessage(
                    author,
                    `Impossible d'envoyer le message d'abonnement dans le salon **#${commandChannel.name}**.`,
                  ),
                  Future.map(() => {}),
                )
              : Future.unit,
          tryDeletePreviousMessageAndSetCalls(guild, channel, role),
        ),
      ),
    )
  }

  function sendInitMessage(
    commandChannel: TextBasedChannels,
    callsChannel: ThreadChannel | APIInteractionDataResolvedChannel | GuildChannel,
    role: Role | APIRole,
  ): Future<Maybe<Message>> {
    const message = StringUtils.stripMargins(
      `Yoho, ${role} !
      |
      |Tu peux t'abonner aux appels sur ce serveur en cliquant ci-dessous !
      |Ils seront notifiés dans le salon ${callsChannel} (que tu devrais rendre muet).
      |
      |||Cliquer t'ajoute (ou t'enlève) le rôle ${role}||`,
    )
    const row = new MessageActionRow().addComponents(
      new MessageButton()
        .setCustomId(callsButton.subscribeId)
        .setLabel("S'abonner aux appels")
        .setStyle('PRIMARY')
        .setEmoji(globalConfig.callsEmoji),
      new MessageButton()
        .setCustomId(callsButton.unsubscribeId)
        .setLabel(' ̶S̶e̶ ̶d̶é̶s̶a̶b̶o̶n̶n̶e̶r̶    Je suis une victime')
        .setStyle('SECONDARY'),
    )
    return DiscordConnector.sendPrettyMessage(commandChannel, message, { components: [row] })
  }

  function tryDeletePreviousMessageAndSetCalls(
    guild: Guild,
    channel: TextChannel,
    role: Role,
  ): (message: Message) => Future<void> {
    return message =>
      pipe(
        guildStateService.getCalls(guild),
        Future.chain(
          Maybe.fold(
            () => Future.unit,
            previous => deleteMessage(previous.message),
          ),
        ),
        Future.map(() => guildStateService.setCalls(guild, { message, channel, role })),
        Future.chain(Future.fromIOEither),
        Future.map(() => {}),
      )
  }

  function fetchUser(user: User | APIUser): Future<Maybe<User>> {
    return user instanceof User
      ? Future.right(Maybe.some(user))
      : discord.fetchUser(TSnowflake.wrap(user.id))
  }

  function fetchChannel(
    maybeChannel: Maybe<ThreadChannel | APIInteractionDataResolvedChannel | GuildChannel>,
  ): Future<Maybe<TextChannel>> {
    return pipe(
      maybeChannel,
      Maybe.fold(
        () => Future.right(Maybe.none),
        channel =>
          channel instanceof TextChannel
            ? Future.right(Maybe.some(channel))
            : pipe(
                discord.fetchChannel(TSnowflake.wrap(channel.id)),
                Future.map(Maybe.filter(ChannelUtils.isTextChannel)),
              ),
      ),
    )
  }

  function fetchRole(
    maybeGuild: Maybe<Guild>,
    maybeRole: Maybe<Role | APIRole>,
  ): Future<Maybe<Role>> {
    return pipe(
      apply.sequenceS(Maybe.Apply)({ guild: maybeGuild, role: maybeRole }),
      Maybe.fold(
        () => Future.right(Maybe.none),
        ({ guild, role }) =>
          role instanceof Role
            ? Future.right(Maybe.some(role))
            : DiscordConnector.fetchRole(guild, TSnowflake.wrap(role.id)),
      ),
    )
  }

  function deleteMessage(message: Message): Future<void> {
    return pipe(
      DiscordConnector.deleteMessage(message),
      Future.chain(deleted =>
        deleted
          ? Future.unit
          : Future.fromIOEither(
              LogUtils.pretty(
                logger,
                message.guild,
                message.author,
                message.channel,
              )('info', 'Not enough permissions to delete message'),
            ),
      ),
    )
  }
}
