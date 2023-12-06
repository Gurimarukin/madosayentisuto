import type {
  APIInteractionGuildMember,
  APIPartialChannel,
  APIRole,
  ChatInputCommandInteraction,
  Guild,
  GuildMember,
  Message,
  MessageContextMenuCommandInteraction,
  MessageEditOptions,
  ModalSubmitInteraction,
} from 'discord.js'
import { ChannelType, DiscordAPIError, Role, TextChannel, User, codeBlock } from 'discord.js'
import { apply } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'
import type { Decoder } from 'io-ts/Decoder'
import * as D from 'io-ts/Decoder'

import { ChannelId } from '../../../shared/models/ChannelId'
import { DiscordUserId } from '../../../shared/models/DiscordUserId'
import { ValidatedNea } from '../../../shared/models/ValidatedNea'
import { ObserverWithRefinement } from '../../../shared/models/rx/ObserverWithRefinement'
import { StringUtils } from '../../../shared/utils/StringUtils'
import {
  Either,
  Future,
  List,
  Maybe,
  NonEmptyArray,
  NotUsed,
  toNotUsed,
} from '../../../shared/utils/fp'
import { futureEither } from '../../../shared/utils/futureEither'
import { futureMaybe } from '../../../shared/utils/futureMaybe'

import type { Config } from '../../config/Config'
import type { MyInteraction } from '../../helpers/DiscordConnector'
import { DiscordConnector, isMissingPermissionsError } from '../../helpers/DiscordConnector'
import type { TheQuestHelper } from '../../helpers/TheQuestHelper'
import { AutoroleMessage } from '../../helpers/messages/AutoroleMessage'
import { DeleteMessageModal } from '../../helpers/modals/DeleteMessageModal'
import type { EditMessageModalDefault } from '../../helpers/modals/EditMessageModal'
import { EditMessageModal, EditMessageModalAutorole } from '../../helpers/modals/EditMessageModal'
import { RoleId } from '../../models/RoleId'
import type { Activity } from '../../models/botState/Activity'
import { ActivityTypeBot } from '../../models/botState/ActivityTypeBot'
import { Command } from '../../models/discord/Command'
import { MadEvent } from '../../models/event/MadEvent'
import type { Calls } from '../../models/guildState/Calls'
import type { GuildState } from '../../models/guildState/GuildState'
import type { LoggerGetter } from '../../models/logger/LoggerObservable'
import type { BotStateService } from '../../services/BotStateService'
import type { EmojidexService } from '../../services/EmojidexService'
import type { GuildStateService } from '../../services/GuildStateService'
import { ChannelUtils } from '../../utils/ChannelUtils'
import { DebugError } from '../../utils/debugLeft'
import { formatNickname } from '../../utils/formatNickname'

const Keys = {
  admin: 'admin',
  state: 'state',
  calls: 'calls',
  channel: 'channel',
  role: 'role',
  autorole: 'autorole',
  add: 'add',
  descriptionMessage: 'description-message',
  addButton: 'add-button',
  removeButton: 'remove-button',
  addButtonEmoji: 'add-button-emoji',
  removeButtonEmoji: 'remove-button-emoji',
  defaultRole: 'default-role',
  itsFriday: 'its-friday',
  birthday: 'birthday',
  activity: 'activity',
  type: 'type',
  name: 'name',
  refresh: 'refresh',
  get: 'get',
  set: 'set',
  unset: 'unset',
  say: 'say',
  what: 'what',
  rename: 'rename',
  user: 'user',
  nickname: 'nickname',
  theQuest: 'the-quest',
  editMessage: 'Edit (admin)',
  deleteMessage: 'Delete (admin)',
}

const adminCommand = Command.chatInput({
  name: Keys.admin,
  description: 'Administration de Jean Plank (réservé aux admins du bot)',
})(
  Command.option.subcommandGroup({
    name: Keys.state,
    description: "Dans quel état j'erre ?",
  })(
    Command.option.subcommand({
      name: Keys.get,
      description: 'État de Jean Plank pour ce serveur',
    })(),
  ),

  /**
   * Jean Plank envoie un message dans le salon où la commande a été effectuée.
   * Les membres d'équipage qui clique sur obtiennent le rôle <role> (ou le perdent).
   * À la suite de quoi, lorsqu'un appel commence sur le serveur, ils seront notifiés dans le salon <channel> en étant mentionné par le rôle <role>.`
   */
  Command.option.subcommandGroup({
    name: Keys.calls,
    description: "Jean Plank n'est pas votre secrétaire, mais il gère vos appels",
  })(
    Command.option.subcommand({
      name: Keys.set,
      description: 'Pour définir la gestion des appels',
    })(
      Command.option.role({
        name: Keys.role,
        description: 'Le rôle qui sera notifié des appels',
        required: true,
      }),
    ),
    Command.option.subcommand({
      name: Keys.unset,
      description: "Plus de notifications d'appel",
    })(),
  ),

  Command.option.subcommandGroup({
    name: Keys.autorole,
    description: 'Jean Plank ajoute et enlève des rôles pour vous',
  })(
    Command.option.subcommand({
      name: Keys.add,
      description: 'Nouvel autorole',
    })(
      Command.option.role({
        name: Keys.role,
        description: 'Le rôle à ajouter et enlever',
        required: true,
      }),
      Command.option.string({
        name: Keys.descriptionMessage,
        description: EditMessageModalAutorole.Labels.descriptionMessage,
        required: true,
      }),
      Command.option.string({
        name: Keys.addButton,
        description: EditMessageModalAutorole.Labels.addButton,
        required: true,
      }),
      Command.option.string({
        name: Keys.removeButton,
        description: EditMessageModalAutorole.Labels.removeButton,
        required: true,
      }),
      Command.option.string({
        name: Keys.addButtonEmoji,
        description: EditMessageModalAutorole.Labels.addButtonEmoji,
      }),
      Command.option.string({
        name: Keys.removeButtonEmoji,
        description: EditMessageModalAutorole.Labels.removeButtonEmoji,
      }),
    ),
  ),

  Command.option.subcommandGroup({
    name: Keys.defaultRole,
    description: "Jean Plank donne un rôle au nouveau membres d'équipages",
  })(
    Command.option.subcommand({
      name: Keys.set,
      description: 'Jean Plank veut bien changer le rôle par défaut de ce serveur',
    })(
      Command.option.role({
        name: Keys.role,
        description: 'Le nouveau rôle par défaut',
        required: true,
      }),
    ),
    Command.option.subcommand({
      name: Keys.unset,
      description: 'Plus de rôle par défaut',
    })(),
  ),

  Command.option.subcommandGroup({
    name: Keys.itsFriday,
    description: "Jean Plank vous informe que nous sommes vendredi (c'est vrai)",
  })(
    Command.option.subcommand({
      name: Keys.set,
      description: 'Jean Plank veut bien changer le salon pour cette information vitale',
    })(
      Command.option.channel({
        name: Keys.channel,
        description: 'Le nouveau salon pour cette information vitale',
        channel_types: [ChannelType.GuildText],
        required: true,
      }),
    ),
    Command.option.subcommand({
      name: Keys.unset,
      description: 'Plus de notifications de vendredi',
    })(),
  ),

  Command.option.subcommandGroup({
    name: Keys.birthday,
    description: "Jean Plank vous informe que c'est l'anniversaire de bidule",
  })(
    Command.option.subcommand({
      name: Keys.set,
      description: 'Jean Plank veut bien changer le salon pour cette information vitale',
    })(
      Command.option.channel({
        name: Keys.channel,
        description: 'Le nouveau salon pour cette information vitale',
        channel_types: [ChannelType.GuildText],
        required: true,
      }),
    ),
    Command.option.subcommand({
      name: Keys.unset,
      description: "Plus de notifications d'anniversaires",
    })(),
  ),

  Command.option.subcommandGroup({
    name: Keys.activity,
    description: 'Jean Plank est un captaine occupé et le fait savoir',
  })(
    Command.option.subcommand({
      name: Keys.get,
      description: "Jean Plank vous informe de ce qu'il est en train de faire",
    })(),
    Command.option.subcommand({
      name: Keys.unset,
      description: "Jean Plank a fini ce qu'il était en train de faire",
    })(),
    Command.option.subcommand({
      name: Keys.set,
      description: "Jean Plank annonce au monde ce qu'il est en train de faire",
    })(
      Command.option.string({
        name: Keys.type,
        description: "Le type d'activité que Jean Plank est en train de faire",
        choices: pipe(
          ActivityTypeBot.values,
          List.map(a => Command.choice(a, a)),
        ),
        required: true,
      }),
      Command.option.string({
        name: Keys.name,
        description: "L'activité que Jean Plank est en train de faire",
        required: true,
      }),
    ),
    Command.option.subcommand({
      name: Keys.refresh,
      description: 'Jean Plank a parfois besoin de rappeler au monde à quel point il est occupé',
    })(),
  ),

  Command.option.subcommand({
    name: Keys.say,
    description: 'Faites dire quelque chose à Jean Plank',
  })(
    Command.option.string({
      name: Keys.what,
      description: "Ce qu'il faut dire",
      required: true,
    }),
  ),

  Command.option.subcommand({
    name: Keys.rename,
    description: 'Jean Plank peut renommer un utilisateur pour vous',
  })(
    Command.option.user({
      name: Keys.user,
      description: "L'utilisateur à renommer",
      required: true,
    }),
    Command.option.string({
      name: Keys.nickname,
      description: "Le nouveau pseudo (laisser vide pour le nom d'utilisateur)",
    }),
  ),

  Command.option.subcommandGroup({
    name: Keys.theQuest,
    description: 'Jean Plank tient à jour le classement de La Quête',
  })(
    Command.option.subcommand({
      name: Keys.set,
      description: 'Jean Plank veut bien changer le salon pour La Quête',
    })(
      Command.option.channel({
        name: Keys.channel,
        description: 'Le nouveau salon pour La Quête',
        channel_types: [ChannelType.GuildText],
        required: true,
      }),
    ),
    Command.option.subcommand({
      name: Keys.unset,
      description: 'Plus de mises à joru pour La Quête',
    })(),
  ),
)

const messageEditCommand = Command.message({ name: Keys.editMessage })

const messageDeleteCommand = Command.message({ name: Keys.deleteMessage })

export const adminCommands = [adminCommand, messageEditCommand, messageDeleteCommand]

type GroupWithSubcommand = {
  subcommandGroup: Maybe<string>
  subcommand: string
}

export const AdminCommandsObserver = (
  Logger: LoggerGetter,
  config: Config,
  discord: DiscordConnector,
  theQuestHelper: TheQuestHelper,
  emojidexService: EmojidexService,
  botStateService: BotStateService,
  guildStateService: GuildStateService,
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
) => {
  const logger = Logger('AdminCommandsObserver')

  return ObserverWithRefinement.fromNext(
    MadEvent,
    'InteractionCreate',
  )(({ interaction }) => {
    if (interaction.isChatInputCommand()) return onChatInputCommand(interaction)
    if (interaction.isMessageContextMenuCommand()) return onMessageContextMenu(interaction)
    if (interaction.isModalSubmit()) return onModalSubmit(interaction)
    return Future.notUsed
  })

  function onChatInputCommand(interaction: ChatInputCommandInteraction): Future<NotUsed> {
    switch (interaction.commandName) {
      case Keys.admin:
        return onAdminCommand(interaction)
    }
    return Future.notUsed
  }

  function onAdminCommand(interaction: ChatInputCommandInteraction): Future<NotUsed> {
    return pipe(
      validateAdminCommand(interaction),
      Either.fold(
        content => DiscordConnector.interactionReply(interaction, { content, ephemeral: true }),
        onValidatedAdminCommand(interaction),
      ),
    )
  }

  function validateAdminCommand(
    interaction: ChatInputCommandInteraction,
  ): Either<string, GroupWithSubcommand> {
    return pipe(
      validateIsAdmin(interaction.user),
      Either.chain(() => {
        const subcommandGroup = Maybe.fromNullable(interaction.options.getSubcommandGroup(false))
        const subcommand = interaction.options.getSubcommand(false)
        if (subcommand === null) return Either.left('Erreur')

        return Either.right({ subcommandGroup, subcommand })
      }),
    )
  }

  function onValidatedAdminCommand(
    interaction: ChatInputCommandInteraction,
  ): (groupWithSubcommand: GroupWithSubcommand) => Future<NotUsed> {
    return ({ subcommandGroup, subcommand }) =>
      pipe(
        subcommandGroup,
        Maybe.fold(
          () => onAdminSubcommandOnly(interaction, subcommand),
          onAdminSubcommand(interaction, subcommand),
        ),
      )
  }

  function onAdminSubcommand(
    interaction: ChatInputCommandInteraction,
    subcommand: string,
  ): (subcommandGroup: string) => Future<NotUsed> {
    return subcommandGroup => {
      switch (subcommandGroup) {
        case Keys.state:
          return onState(interaction, subcommand)
        case Keys.calls:
          return onCalls(interaction, subcommand)
        case Keys.autorole:
          return onAutorole(interaction, subcommand)
        case Keys.defaultRole:
          return onDefaultRole(interaction, subcommand)
        case Keys.itsFriday:
          return onItsFriday(interaction, subcommand)
        case Keys.birthday:
          return onBirthday(interaction, subcommand)
        case Keys.activity:
          return onActivity(interaction, subcommand)
        case Keys.theQuest:
          return onTheQuest(interaction, subcommand)
      }
      return Future.notUsed
    }
  }

  function onAdminSubcommandOnly(
    interaction: ChatInputCommandInteraction,
    subcommand: string,
  ): Future<NotUsed> {
    switch (subcommand) {
      case Keys.say:
        return onSay(interaction)
      case Keys.rename:
        return onRename(interaction)
    }
    return Future.notUsed
  }

  /**
   * state
   */

  function onState(interaction: ChatInputCommandInteraction, subcommand: string): Future<NotUsed> {
    switch (subcommand) {
      case Keys.get:
        return onStateGet(interaction)
    }
    return Future.notUsed
  }

  function onStateGet(interaction: ChatInputCommandInteraction): Future<NotUsed> {
    return pipe(
      DiscordConnector.interactionDeferReply(interaction, { ephemeral: true }),
      Future.map(() => Maybe.fromNullable(interaction.guild)),
      futureMaybe.chainTaskEitherK(guild => guildStateService.getState(guild)),
      futureMaybe.match(() => 'Rien à montrer pour ce serveur', formatState),
      Future.chain(content =>
        DiscordConnector.interactionFollowUp(interaction, { content, ephemeral: true }),
      ),
      Future.map(toNotUsed),
    )
  }

  /**
   * calls
   */

  function onCalls(interaction: ChatInputCommandInteraction, subcommand: string): Future<NotUsed> {
    switch (subcommand) {
      case Keys.set:
        return onCallsSet(interaction)
      case Keys.unset:
        return onCallsUnset(interaction)
    }
    return Future.notUsed
  }

  function onCallsSet(interaction: ChatInputCommandInteraction): Future<NotUsed> {
    return withFollowUpIsAdmin(interaction)(
      pipe(
        apply.sequenceS(futureMaybe.ApplyPar)({
          channel: pipe(
            interaction.channel,
            futureMaybe.fromNullable,
            futureMaybe.filter(ChannelUtils.isGuildSendable),
          ),
          role: fetchRole(interaction.guild, interaction.options.getRole(Keys.role)),
        }),
        futureMaybe.chainFirstTaskEitherK(({ channel, role }) =>
          guildStateService.setCalls(channel.guild, Maybe.some({ channel, role })),
        ),
        futureMaybe.match(
          () => 'Erreur',
          ({ channel, role }) =>
            // TODO: remove disable
            // eslint-disable-next-line @typescript-eslint/no-base-to-string
            `Nouveau paramètres d'appels : ${role} - ${channel}`,
        ),
      ),
    )
  }

  function onCallsUnset(interaction: ChatInputCommandInteraction): Future<NotUsed> {
    if (interaction.guild === null) return Future.notUsed
    return withFollowUpIsAdmin(interaction)(
      pipe(
        guildStateService.setCalls(interaction.guild, Maybe.none),
        Future.map(() => "Nouveau paramètres d'appels : `null`"),
      ),
    )
  }

  /**
   * autorole
   */

  function onAutorole(
    interaction: ChatInputCommandInteraction,
    subcommand: string,
  ): Future<NotUsed> {
    switch (subcommand) {
      case Keys.add:
        return onAutoroleAdd(interaction)
    }
    return Future.notUsed
  }

  function onAutoroleAdd(interaction: ChatInputCommandInteraction): Future<NotUsed> {
    return pipe(
      DiscordConnector.interactionReply(interaction, { content: '...', ephemeral: false }),
      Future.chain(() => DiscordConnector.interactionDeleteReply(interaction)),
      Future.chain(() =>
        apply.sequenceS(futureMaybe.ApplyPar)({
          author: fetchUser(Maybe.fromNullable(interaction.member)),
          commandChannel: pipe(
            interaction.channel,
            futureMaybe.fromNullable,
            futureMaybe.filter(ChannelUtils.isGuildText),
          ),
          role: fetchRole(interaction.guild, interaction.options.getRole(Keys.role)),
          descriptionMessage: futureMaybe.fromNullable(
            interaction.options.getString(Keys.descriptionMessage),
          ),
          addButton: futureMaybe.fromNullable(interaction.options.getString(Keys.addButton)),
          removeButton: futureMaybe.fromNullable(interaction.options.getString(Keys.removeButton)),
        }),
      ),
      futureMaybe.chainTaskEitherK(a =>
        sendAutoroleMessage(a.author, a.commandChannel, a.role, {
          descriptionMessage: a.descriptionMessage,
          addButton: a.addButton,
          removeButton: a.removeButton,
          addButtonEmoji: Maybe.fromNullable(interaction.options.getString(Keys.addButtonEmoji)),
          removeButtonEmoji: Maybe.fromNullable(
            interaction.options.getString(Keys.removeButtonEmoji),
          ),
        }),
      ),
      Future.map(toNotUsed),
    )
  }

  function sendAutoroleMessage(
    author: User,
    commandChannel: TextChannel,
    role: Role,
    args: Omit<AutoroleMessage, 'roleId'>,
  ): Future<NotUsed> {
    const options = AutoroleMessage.of({
      roleId: RoleId.fromRole(role),
      ...args,
      descriptionMessage: args.descriptionMessage.replaceAll('\\n', '\n'),
    })
    return pipe(
      DiscordConnector.sendMessage(commandChannel, options),
      futureMaybe.chainFirstTaskEitherK(message =>
        // we want the `(edited)` label on message so we won't have a layout shift
        DiscordConnector.messageEdit(message, options),
      ),
      futureMaybe.matchE(
        () =>
          ChannelUtils.isNamed(commandChannel)
            ? pipe(
                DiscordConnector.sendPrettyMessage(
                  author,
                  `Impossible d'envoyer le message d'autorole **@${role.name}** dans le salon **#${commandChannel.name}**.`,
                ),
                Future.map(toNotUsed),
              )
            : Future.notUsed,
        () => Future.notUsed,
      ),
    )
  }

  /**
   * defaultrole
   */

  function onDefaultRole(
    interaction: ChatInputCommandInteraction,
    subcommand: string,
  ): Future<NotUsed> {
    switch (subcommand) {
      case Keys.set:
        return onDefaultRoleSet(interaction)
      case Keys.unset:
        return onDefaultRoleUnset(interaction)
    }
    return Future.notUsed
  }

  function onDefaultRoleSet(interaction: ChatInputCommandInteraction): Future<NotUsed> {
    return withFollowUpIsAdmin(interaction)(
      pipe(
        apply.sequenceS(futureMaybe.ApplyPar)({
          guild: futureMaybe.fromNullable(interaction.guild),
          defaultRole: fetchRole(interaction.guild, interaction.options.getRole(Keys.role)),
        }),
        futureMaybe.chainFirstTaskEitherK(({ guild, defaultRole }) =>
          guildStateService.setDefaultRole(guild, Maybe.some(defaultRole)),
        ),
        futureMaybe.match(
          () => 'Erreur',
          ({ defaultRole }) => `Nouveau rôle par défaut : ${defaultRole}`,
        ),
      ),
    )
  }

  function onDefaultRoleUnset(interaction: ChatInputCommandInteraction): Future<NotUsed> {
    if (interaction.guild === null) return Future.notUsed
    return withFollowUpIsAdmin(interaction)(
      pipe(
        guildStateService.setDefaultRole(interaction.guild, Maybe.none),
        Future.map(() => 'Nouveau rôle par défaut : `null`'),
      ),
    )
  }

  /**
   * itsfriday
   */

  function onItsFriday(
    interaction: ChatInputCommandInteraction,
    subcommand: string,
  ): Future<NotUsed> {
    switch (subcommand) {
      case Keys.set:
        return onItsFridaySet(interaction)
      case Keys.unset:
        return onItsFridayUnset(interaction)
    }
    return Future.notUsed
  }

  function onItsFridaySet(interaction: ChatInputCommandInteraction): Future<NotUsed> {
    return withFollowUpIsAdmin(interaction)(
      pipe(
        apply.sequenceS(futureMaybe.ApplyPar)({
          guild: futureMaybe.fromNullable(interaction.guild),
          channel: fetchChannel(Maybe.fromNullable(interaction.options.getChannel(Keys.channel))),
        }),
        futureMaybe.chainFirstTaskEitherK(({ guild, channel }) =>
          guildStateService.setItsFridayChannel(guild, Maybe.some(channel)),
        ),
        futureMaybe.match(
          () => 'Erreur',
          ({ channel }) => `Nouveau salon pour "C'est vendredi" : ${channel}`,
        ),
      ),
    )
  }

  function onItsFridayUnset(interaction: ChatInputCommandInteraction): Future<NotUsed> {
    if (interaction.guild === null) return Future.notUsed
    return withFollowUpIsAdmin(interaction)(
      pipe(
        guildStateService.setItsFridayChannel(interaction.guild, Maybe.none),
        Future.map(() => `Nouveau salon pour "C'est vendredi" : \`null\``),
      ),
    )
  }

  /**
   * birthday
   */

  function onBirthday(
    interaction: ChatInputCommandInteraction,
    subcommand: string,
  ): Future<NotUsed> {
    switch (subcommand) {
      case Keys.set:
        return onBirthdaySet(interaction)
      case Keys.unset:
        return onBirthdayUnset(interaction)
    }
    return Future.notUsed
  }

  function onBirthdaySet(interaction: ChatInputCommandInteraction): Future<NotUsed> {
    return withFollowUpIsAdmin(interaction)(
      pipe(
        apply.sequenceS(futureMaybe.ApplyPar)({
          guild: futureMaybe.fromNullable(interaction.guild),
          birthdayChannel: fetchChannel(
            Maybe.fromNullable(interaction.options.getChannel(Keys.channel)),
          ),
        }),
        futureMaybe.chainFirstTaskEitherK(({ guild, birthdayChannel }) =>
          guildStateService.setBirthdayChannel(guild, Maybe.some(birthdayChannel)),
        ),
        futureMaybe.match(
          () => 'Erreur',
          ({ birthdayChannel }) => `Nouveau salon pour les anniversaires : ${birthdayChannel}`,
        ),
      ),
    )
  }

  function onBirthdayUnset(interaction: ChatInputCommandInteraction): Future<NotUsed> {
    if (interaction.guild === null) return Future.notUsed
    return withFollowUpIsAdmin(interaction)(
      pipe(
        guildStateService.setBirthdayChannel(interaction.guild, Maybe.none),
        Future.map(() => 'Nouveau salon pour les anniversaires : `null`'),
      ),
    )
  }

  /**
   * activity
   */

  function onActivity(
    interaction: ChatInputCommandInteraction,
    subcommand: string,
  ): Future<NotUsed> {
    switch (subcommand) {
      case Keys.get:
        return onActivityGet(interaction)
      case Keys.unset:
        return onActivityUnset(interaction)
      case Keys.set:
        return onActivitySet(interaction)
      case Keys.refresh:
        return onActivityRefresh(interaction)
    }
    return Future.notUsed
  }

  function onActivityGet(interaction: ChatInputCommandInteraction): Future<NotUsed> {
    return withFollowUpIsAdmin(interaction)(
      pipe(
        botStateService.find(),
        Future.map(({ activity }) => activity),
        futureMaybe.match(() => 'No activity', formatActivity),
      ),
    )
  }

  function onActivityUnset(interaction: ChatInputCommandInteraction): Future<NotUsed> {
    return withFollowUpIsAdmin(interaction)(
      pipe(
        botStateService.unsetActivity(),
        Future.map(() => 'Activity unset'),
      ),
    )
  }

  function onActivitySet(interaction: ChatInputCommandInteraction): Future<NotUsed> {
    return withFollowUpIsAdmin(interaction)(
      pipe(
        apply.sequenceS(ValidatedNea.getValidation<string>())({
          type: decode(ActivityTypeBot.decoder, interaction.options.getString(Keys.type)),
          name: decode(D.string, interaction.options.getString(Keys.name)),
        }),
        Either.mapLeft(
          flow(List.mkString('Invalid options from command "activity set":\n', '\n', ''), Error),
        ),
        Future.fromEither,
        Future.chainFirst(activity => botStateService.setActivity(activity)),
        Future.map(activity => `Activity set to: ${formatActivity(activity)}`),
      ),
    )
  }

  function onActivityRefresh(interaction: ChatInputCommandInteraction): Future<NotUsed> {
    return withFollowUpIsAdmin(interaction)(
      pipe(
        botStateService.discordSetActivityFromDb(),
        Future.map(() => 'Activity refreshed'),
      ),
    )
  }

  /**
   * theQuest
   */

  function onTheQuest(
    interaction: ChatInputCommandInteraction,
    subcommand: string,
  ): Future<NotUsed> {
    switch (subcommand) {
      case Keys.set:
        return onTheQuestSet(interaction)
      case Keys.unset:
        return onTheQuestUnset(interaction)
    }
    return Future.notUsed
  }

  function onTheQuestSet(interaction: ChatInputCommandInteraction): Future<NotUsed> {
    return withFollowUpIsAdmin(interaction)(
      pipe(
        apply.sequenceS(futureMaybe.ApplyPar)({
          guild: futureMaybe.fromNullable(interaction.guild),
          channel: fetchChannel(Maybe.fromNullable(interaction.options.getChannel(Keys.channel))),
        }),
        futureMaybe.chain(({ guild, channel }) =>
          theQuestHelper.sendNotificationsAndRefreshMessage(guild, channel),
        ),
        futureMaybe.match(
          () => 'Erreur',
          message => `Nouveau salon pour La Quête : ${message.url}`,
        ),
      ),
    )
  }

  function onTheQuestUnset(interaction: ChatInputCommandInteraction): Future<NotUsed> {
    const guild = interaction.guild
    if (guild === null) return Future.notUsed
    return withFollowUpIsAdmin(interaction)(
      pipe(
        guildStateService.getTheQuestMessage(guild),
        futureMaybe.chainTaskEitherK(DiscordConnector.messageDelete),
        Future.chain(() => guildStateService.setTheQuestMessage(guild, Maybe.none)),
        Future.map(() => 'Nouveau salon pour La Quête : `null`'),
      ),
    )
  }

  /**
   * say
   */

  function onSay(interaction: ChatInputCommandInteraction): Future<NotUsed> {
    return pipe(
      apply.sequenceS(Either.Apply)({
        content: pipe(
          interaction.options.getString(Keys.what),
          Either.fromNullable(Error(`Missing option "${Keys.what}" for command "say"`)),
        ),
        channel: pipe(
          Maybe.fromNullable(interaction.channel),
          Maybe.filter(ChannelUtils.isGuildSendable),
          Either.fromOption(() => Error(`Invalid or missing channel for command "say"`)),
        ),
      }),
      Future.fromEither,
      Future.bind('message', ({ content, channel }) =>
        DiscordConnector.sendMessage(channel, content.replaceAll('\\n', '\n')),
      ),
      Future.chain(({ message, channel }) =>
        pipe(
          message,
          Maybe.fold(
            () =>
              pipe(
                // TODO: remove disable
                // eslint-disable-next-line @typescript-eslint/no-base-to-string
                logger.warn(`Couldn't say message in channel ${channel}`),
                Future.fromIOEither,
                Future.chain(() =>
                  DiscordConnector.interactionReply(interaction, {
                    content: 'Erreur',
                    ephemeral: true,
                  }),
                ),
              ),
            () =>
              pipe(
                DiscordConnector.interactionReply(interaction, {
                  content: '...',
                  ephemeral: false,
                }),
                Future.chain(() => DiscordConnector.interactionDeleteReply(interaction)),
              ),
          ),
        ),
      ),
    )
  }

  /**
   * rename
   */

  function onRename(interaction: ChatInputCommandInteraction): Future<NotUsed> {
    return pipe(
      apply.sequenceS(Maybe.Apply)({
        guild: Maybe.fromNullable(interaction.guild),
        user: Maybe.fromNullable(interaction.options.getUser(Keys.user)),
        newNickname: Maybe.some(Maybe.fromNullable(interaction.options.getString(Keys.nickname))),
      }),
      futureMaybe.fromOption,
      futureMaybe.bind('member', ({ guild, user }) =>
        DiscordConnector.fetchMember(guild, DiscordUserId.fromUser(user)),
      ),
      futureMaybe.bind('oldNickname', ({ member }) => futureMaybe.some(member.nickname)),
      futureMaybe.chainFirst(({ member, newNickname }) =>
        pipe(
          DiscordConnector.memberSetNickname(member, newNickname),
          Future.map(Maybe.some),
          Future.orElse(e =>
            e instanceof DebugError && isMissingPermissionsError(e.originalError)
              ? futureMaybe.none
              : Future.failed(e),
          ),
        ),
      ),
      futureMaybe.match(
        () => 'Erreur',
        ({ member, oldNickname, newNickname }) =>
          `Pseudo de ${member} changé de ${formatNickname(oldNickname)} à ${formatNickname(
            newNickname,
          )}`,
      ),
      Future.chain(content =>
        DiscordConnector.interactionReply(interaction, { content, ephemeral: true }),
      ),
    )
  }

  /**
   * onMessageContextMenu
   */

  function onMessageContextMenu(
    interaction: MessageContextMenuCommandInteraction,
  ): Future<NotUsed> {
    switch (interaction.commandName) {
      case Keys.editMessage:
        return onMessageContextMenuEditMessage(interaction)
      case Keys.deleteMessage:
        return onMessageContextMenuDeleteMessage(interaction)
    }
    return Future.notUsed
  }

  function onMessageContextMenuEditMessage(
    interaction: MessageContextMenuCommandInteraction,
  ): Future<NotUsed> {
    return pipe(
      validateIsAdmin(interaction.user),
      Either.filterOrElse(
        () =>
          DiscordUserId.Eq.equals(
            DiscordUserId.fromUser(interaction.targetMessage.author),
            config.client.id,
          ),
        () => cannotEditOthersMessage,
      ),
      Either.fold(
        content => DiscordConnector.interactionReply(interaction, { content, ephemeral: true }),
        () =>
          pipe(
            EditMessageModal.fromMessage(logger)(interaction.targetMessage),
            Future.fromIOEither,
            Future.chain(modal => DiscordConnector.interactionShowModal(interaction, modal)),
          ),
      ),
    )
  }

  function onMessageContextMenuDeleteMessage(
    interaction: MessageContextMenuCommandInteraction,
  ): Future<NotUsed> {
    return pipe(
      validateIsAdmin(interaction.user),
      Either.fold(
        content => DiscordConnector.interactionReply(interaction, { content, ephemeral: true }),
        () =>
          DiscordConnector.interactionShowModal(
            interaction,
            DeleteMessageModal.fromMessage(interaction.targetMessage),
          ),
      ),
    )
  }

  /**
   * onModalSubmit
   */

  function onModalSubmit(interaction: ModalSubmitInteraction): Future<NotUsed> {
    return pipe(
      Maybe.none,
      Maybe.alt(() =>
        pipe(
          DeleteMessageModal.fromInteraction(interaction),
          Maybe.map(onDeleteMessageModalSubmit(interaction)),
        ),
      ),
      Maybe.alt(() =>
        pipe(
          EditMessageModal.fromInteraction(interaction),
          Maybe.map(onEditMessageModalSubmit(interaction)),
        ),
      ),
      Maybe.getOrElse(() => Future.notUsed),
    )
  }

  function onDeleteMessageModalSubmit(
    interaction: ModalSubmitInteraction,
  ): (modal: DeleteMessageModal) => Future<NotUsed> {
    return modal => {
      const guild = interaction.guild
      if (guild === null) return Future.notUsed
      return withFollowUpIsAdmin(interaction)(
        pipe(
          DiscordConnector.fetchMessage(guild, modal.messageId),
          Future.map(Either.fromOption(() => 'Erreur, message non trouvé')),
          futureEither.chainTaskEitherK(message => DiscordConnector.messageDelete(message)),
          futureEither.filterOrElse(
            success => success,
            () => 'Erreur',
          ),
          Future.map(
            Either.fold(
              error => error,
              () => 'Message supprimé.',
            ),
          ),
        ),
      )
    }
  }

  function onEditMessageModalSubmit(
    interaction: ModalSubmitInteraction,
  ): (modal: EditMessageModal) => Future<NotUsed> {
    return modalRaw => {
      const guild = interaction.guild
      if (guild === null) return Future.notUsed
      return withFollowUpIsAdmin(interaction)(
        pipe(
          futureEither.Do,
          futureEither.apS(
            'modal',
            pipe(
              EditMessageModal.validate(guild, emojidexService)(modalRaw),
              Future.map(
                Either.mapLeft(nea =>
                  nea.length === 1
                    ? NonEmptyArray.head(nea)
                    : pipe(nea, List.mkString('- ', '\n- ', '')),
                ),
              ),
            ),
          ),
          futureEither.bind('message', ({ modal }) =>
            pipe(
              DiscordConnector.fetchMessage(guild, modal.messageId),
              Future.map(Either.fromOption(() => 'Erreur, message non trouvé')),
            ),
          ),
          futureEither.filterOrElse(
            ({ message }) =>
              DiscordUserId.Eq.equals(DiscordUserId.fromUser(message.author), config.client.id),
            () => cannotEditOthersMessage,
          ),
          futureEither.bind('options', ({ modal, message }) =>
            pipe(
              modal,
              EditMessageModal.fold({
                onAutorole: onEditMessageModalAutoroleSubmit(message),
                onDefault: onEditMessageModalDefaultSubmit(message),
              }),
            ),
          ),
          futureEither.chainTaskEitherK(({ message, options }) =>
            DiscordConnector.messageEdit(message, options),
          ),
          Future.orElse(e =>
            e instanceof DebugError &&
            e.originalError instanceof DiscordAPIError &&
            e.originalError.message.startsWith('Invalid Form Body')
              ? Future.successful(
                  Either.left(`Erreur lors de l'envoi:\n${codeBlock(e.originalError.message)}`),
                )
              : Future.failed(e),
          ),
          Future.map(
            Either.fold(
              e => e,
              () => 'Message modifié',
            ),
          ),
        ),
      )
    }
  }

  function onEditMessageModalAutoroleSubmit(
    message: Message<true>,
  ): (modal: EditMessageModalAutorole) => Future<Either<string, MessageEditOptions>> {
    return ({ descriptionMessage, addButton, removeButton, addButtonEmoji, removeButtonEmoji }) =>
      pipe(
        AutoroleMessage.messageDecoder.decode(message),
        Either.fold(
          e =>
            pipe(
              logger.warn(`Inconsistent state: couldn't decode AutoroleMessage:\n${D.draw(e)}`),
              Future.fromIOEither,
              Future.map(() => Either.left('Erreur')),
            ),
          ({ roleId }) =>
            Future.successful(
              Either.right(
                AutoroleMessage.of({
                  roleId,
                  descriptionMessage,
                  addButton,
                  removeButton,
                  addButtonEmoji,
                  removeButtonEmoji,
                }),
              ),
            ),
        ),
      )
  }

  function onEditMessageModalDefaultSubmit(
    message: Message,
  ): (modal: EditMessageModalDefault) => Future<Either<string, MessageEditOptions>> {
    return ({ content }) => {
      const options: Omit<
        Required<MessageEditOptions>,
        'allowedMentions' | 'attachments' | 'files'
      > = {
        content,
        flags: message.flags.toJSON(),
        embeds: message.embeds,
        components: message.components,
      }
      return Future.successful(Either.right(options))
    }
  }

  /**
   * Helpers
   */

  function validateIsAdmin(user: User): Either<string, NotUsed> {
    const isAdmin = pipe(config.admins, List.elem(DiscordUserId.Eq)(DiscordUserId.fromUser(user)))
    if (!isAdmin) return Either.left('Haha ! Tu ne peux pas faire ça !')
    return Either.right(NotUsed)
  }

  function withFollowUpIsAdmin(interaction: MyInteraction): (f: Future<string>) => Future<NotUsed> {
    return f =>
      pipe(
        DiscordConnector.interactionDeferReply(interaction, { ephemeral: true }),
        Future.chain(() =>
          pipe(
            validateIsAdmin(interaction.user),
            Either.fold(Future.successful, () => f),
            Future.orElse(e =>
              pipe(
                Future.successful('Erreur'),
                Future.chainFirstIOEitherK(() => logger.error(e)),
              ),
            ),
          ),
        ),
        Future.chain(content =>
          DiscordConnector.interactionFollowUp(interaction, { content, ephemeral: true }),
        ),
        Future.map(toNotUsed),
      )
  }

  function fetchUser(
    maybeMember: Maybe<GuildMember | APIInteractionGuildMember>,
  ): Future<Maybe<User>> {
    return pipe(
      futureMaybe.fromOption(maybeMember),
      futureMaybe.chain(({ user }) =>
        user instanceof User
          ? futureMaybe.some(user)
          : discord.fetchUser(DiscordUserId.fromUser(user)),
      ),
    )
  }

  function fetchChannel(maybeChannel: Maybe<APIPartialChannel>): Future<Maybe<TextChannel>> {
    return pipe(
      futureMaybe.fromOption(maybeChannel),
      futureMaybe.chain(channel =>
        channel instanceof TextChannel
          ? futureMaybe.some(channel)
          : pipe(
              discord.fetchChannel(ChannelId.fromChannel(channel)),
              Future.map(Maybe.filter(ChannelUtils.isGuildText)),
            ),
      ),
    )
  }

  function fetchRole(
    maybeGuild: Guild | null,
    maybeRole: Role | APIRole | null,
  ): Future<Maybe<Role>> {
    return pipe(
      apply.sequenceS(Maybe.Apply)({
        guild: Maybe.fromNullable(maybeGuild),
        role: Maybe.fromNullable(maybeRole),
      }),
      futureMaybe.fromOption,
      futureMaybe.chain(({ guild, role }) =>
        role instanceof Role
          ? futureMaybe.some(role)
          : DiscordConnector.fetchRole(guild, RoleId.fromRole(role)),
      ),
    )
  }
}

const maybeStr = <A>(fa: Maybe<A>, str: (a: A) => string = String): string =>
  pipe(
    fa,
    Maybe.map(str),
    Maybe.getOrElse(() => '`null`'),
  )

const formatState = ({
  calls,
  defaultRole,
  itsFridayChannel,
  birthdayChannel,
  theQuestMessage,
  subscription,
}: GuildState): string =>
  StringUtils.stripMargins(
    `- **calls**: ${maybeStr(calls, formatCalls)}
    |- **defaultRole**: ${maybeStr(defaultRole)}
    |- **itsFridayChannel**: ${maybeStr(itsFridayChannel)}
    |- **birthdayChannel**: ${maybeStr(birthdayChannel)}
    |- **theQuestMessage**: ${maybeStr(theQuestMessage, m => m.url)}
    |- **subscription**: ${maybeStr(subscription, s => s.stringify())}`,
  )

const formatCalls = ({ channel, role }: Calls): string =>
  // TODO: remove disable
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  `${role} - ${channel}`

const formatActivity = ({ type, name }: Activity): string => `\`${type} ${name}\``

const decode = <A>(decoder: Decoder<unknown, A>, u: unknown): ValidatedNea<string, A> =>
  pipe(decoder.decode(u), Either.mapLeft(flow(D.draw, NonEmptyArray.of)))

const cannotEditOthersMessage = "Haha ! Je ne peux pas éditer un message que je n'ai pas écrit !"
