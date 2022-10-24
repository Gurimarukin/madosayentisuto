import type {
  APIInteractionGuildMember,
  APIPartialChannel,
  APIRole,
  ChatInputCommandInteraction,
  Guild,
  GuildMember,
  Message,
} from 'discord.js'
import { ChannelType, Role, TextChannel, User } from 'discord.js'
import { apply } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'
import type { Decoder } from 'io-ts/Decoder'
import * as D from 'io-ts/Decoder'

import { ChannelId } from '../../../shared/models/ChannelId'
import { DiscordUserId } from '../../../shared/models/DiscordUserId'
import { ValidatedNea } from '../../../shared/models/ValidatedNea'
import { ObserverWithRefinement } from '../../../shared/models/rx/ObserverWithRefinement'
import { StringUtils } from '../../../shared/utils/StringUtils'
import type { NotUsed } from '../../../shared/utils/fp'
import { Either, Future, IO, List, Maybe, NonEmptyArray, toNotUsed } from '../../../shared/utils/fp'
import { futureMaybe } from '../../../shared/utils/futureMaybe'

import { DiscordConnector } from '../../helpers/DiscordConnector'
import type { AutoroleMessageArgs } from '../../helpers/messages/AutoroleMessage'
import { AutoroleMessage } from '../../helpers/messages/AutoroleMessage'
import { initCallsMessage } from '../../helpers/messages/initCallsMessage'
import { RoleId } from '../../models/RoleId'
import type { Activity } from '../../models/botState/Activity'
import { ActivityTypeBot } from '../../models/botState/ActivityTypeBot'
import { Command } from '../../models/discord/Command'
import { MadEvent } from '../../models/event/MadEvent'
import type { AutoroleMessage as __AutoroleMessage } from '../../models/guildState/AutoRoleMessage'
import type { Calls } from '../../models/guildState/Calls'
import type { GuildState } from '../../models/guildState/GuildState'
import type { LoggerGetter } from '../../models/logger/LoggerObservable'
import type { BotStateService } from '../../services/BotStateService'
import type { GuildStateService } from '../../services/GuildStateService'
import { ChannelUtils } from '../../utils/ChannelUtils'
import { LogUtils } from '../../utils/LogUtils'

const Keys = {
  admin: 'admin',
  state: 'state',
  calls: 'calls',
  init: 'init',
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

  // Ids: {
  //   modal: 'autoroleModal',
  // },
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
      name: Keys.init,
      description: 'Pour initier la gestion des appels',
    })(
      Command.option.channel({
        name: Keys.channel,
        description: 'Le salon dans lequel les appels seront notifiés',
        channel_types: [ChannelType.GuildText],
        required: true,
      }),
      Command.option.role({
        name: Keys.role,
        description: 'Le rôle qui sera notifié des appels',
        required: true,
      }),
    ),
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
        description: "Message d'autorole",
        required: true,
      }),
      Command.option.string({
        name: Keys.addButton,
        description: 'Bouton ajouter',
        required: true,
      }),
      Command.option.string({
        name: Keys.removeButton,
        description: 'Bouton enlever',
        required: true,
      }),
      Command.option.string({
        name: Keys.addButtonEmoji,
        description: 'Émoji bouton ajouter',
      }),
      Command.option.string({
        name: Keys.removeButtonEmoji,
        description: 'Émoji bouton enlever',
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
)

export const adminCommands = [adminCommand]

type GroupWithSubcommand = {
  readonly subcommandGroup: Maybe<string>
  readonly subcommand: string
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const AdminCommandsObserver = (
  Logger: LoggerGetter,
  admins: NonEmptyArray<DiscordUserId>,
  discord: DiscordConnector,
  botStateService: BotStateService,
  guildStateService: GuildStateService,
) => {
  const logger = Logger('AdminCommandsObserver')

  return ObserverWithRefinement.fromNext(
    MadEvent,
    'InteractionCreate',
  )(({ interaction }) => {
    if (interaction.isChatInputCommand()) return onChatInputCommand(interaction)
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
    const isAdmin = pipe(
      admins,
      List.elem(DiscordUserId.Eq)(DiscordUserId.fromUser(interaction.user)),
    )
    if (!isAdmin) return Either.left('Haha ! Tu ne peux pas faire ça !')

    const subcommandGroup = Maybe.fromNullable(interaction.options.getSubcommandGroup(false))
    const subcommand = interaction.options.getSubcommand(false)
    if (subcommand === null) return Either.left('Erreur')

    return Either.right({ subcommandGroup, subcommand })
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
      case Keys.init:
        return onCallsInit(interaction)
    }
    return Future.notUsed
  }

  function onCallsInit(interaction: ChatInputCommandInteraction): Future<NotUsed> {
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
          callsChannel: fetchChannel(
            Maybe.fromNullable(interaction.options.getChannel(Keys.channel)),
          ),
          role: fetchRole(interaction.guild, interaction.options.getRole(Keys.role)),
        }),
      ),
      futureMaybe.chainTaskEitherK(({ author, commandChannel, callsChannel, role }) =>
        sendInitMessageAndUpdateState(author, commandChannel, callsChannel, role),
      ),
      Future.map(toNotUsed),
    )
  }

  function sendInitMessageAndUpdateState(
    author: User,
    commandChannel: TextChannel,
    callsChannel: TextChannel,
    role: Role,
  ): Future<NotUsed> {
    return pipe(
      DiscordConnector.sendMessage<true>(commandChannel, initCallsMessage(callsChannel, role)),
      futureMaybe.matchE(
        () =>
          ChannelUtils.isNamed(commandChannel)
            ? pipe(
                DiscordConnector.sendPrettyMessage(
                  author,
                  `Impossible d'envoyer le message d'abonnement dans le salon **#${commandChannel.name}**.`,
                ),
                Future.map(toNotUsed),
              )
            : Future.notUsed,
        tryDeletePreviousMessageAndSetCalls(callsChannel, role),
      ),
    )
  }

  function tryDeletePreviousMessageAndSetCalls(
    channel: TextChannel,
    role: Role,
  ): (message: Message<true>) => Future<NotUsed> {
    return message =>
      pipe(
        guildStateService.getCalls(channel.guild),
        futureMaybe.chainTaskEitherK(previous => deleteMessage(previous.message)),
        Future.chain(() => guildStateService.setCalls(channel.guild, { message, channel, role })),
        Future.map(toNotUsed),
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
        sendAutoroleMessage(a.author, a.commandChannel, {
          role: a.role,
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
    args: AutoroleMessageArgs,
  ): Future<NotUsed> {
    const options = AutoroleMessage.of({
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
                  `Impossible d'envoyer le message d'autorole **@${args.role.name}** dans le salon **#${commandChannel.name}**.`,
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
    }
    return Future.notUsed
  }

  function onDefaultRoleSet(interaction: ChatInputCommandInteraction): Future<NotUsed> {
    return withFollowUp(interaction)(
      pipe(
        apply.sequenceS(futureMaybe.ApplyPar)({
          guild: futureMaybe.fromNullable(interaction.guild),
          role: fetchRole(interaction.guild, interaction.options.getRole(Keys.role)),
        }),
        futureMaybe.chainTaskEitherK(({ guild, role }) =>
          guildStateService.setDefaultRole(guild, role),
        ),
        futureMaybe.match(
          () => 'Erreur',
          ({ defaultRole }) => `Nouveau rôle par défaut : ${Maybe.toNullable(defaultRole)}`,
        ),
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
    }
    return Future.notUsed
  }

  function onItsFridaySet(interaction: ChatInputCommandInteraction): Future<NotUsed> {
    return withFollowUp(interaction)(
      pipe(
        apply.sequenceS(futureMaybe.ApplyPar)({
          guild: futureMaybe.fromNullable(interaction.guild),
          channel: fetchChannel(Maybe.fromNullable(interaction.options.getChannel(Keys.channel))),
        }),
        futureMaybe.chainTaskEitherK(({ guild, channel }) =>
          guildStateService.setItsFridayChannel(guild, channel),
        ),
        futureMaybe.match(
          () => 'Erreur',
          ({ itsFridayChannel }) =>
            `Nouveau salon pour "C'est vendredi" : ${Maybe.toNullable(itsFridayChannel)}`,
        ),
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
    }
    return Future.notUsed
  }

  function onBirthdaySet(interaction: ChatInputCommandInteraction): Future<NotUsed> {
    return withFollowUp(interaction)(
      pipe(
        apply.sequenceS(futureMaybe.ApplyPar)({
          guild: futureMaybe.fromNullable(interaction.guild),
          channel: fetchChannel(Maybe.fromNullable(interaction.options.getChannel(Keys.channel))),
        }),
        futureMaybe.chainTaskEitherK(({ guild, channel }) =>
          guildStateService.setBirthdayChannel(guild, channel),
        ),
        futureMaybe.match(
          () => 'Erreur',
          ({ birthdayChannel }) =>
            `Nouveau salon pour les anniversaires : ${Maybe.toNullable(birthdayChannel)}`,
        ),
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
    return withFollowUp(interaction)(
      pipe(
        botStateService.find(),
        Future.map(({ activity }) => activity),
        futureMaybe.match(() => 'No activity', formatActivity),
      ),
    )
  }

  function onActivityUnset(interaction: ChatInputCommandInteraction): Future<NotUsed> {
    return withFollowUp(interaction)(
      pipe(
        botStateService.unsetActivity(),
        Future.map(() => 'Activity unset'),
      ),
    )
  }

  function onActivitySet(interaction: ChatInputCommandInteraction): Future<NotUsed> {
    return withFollowUp(interaction)(
      pipe(
        ValidatedNea.sequenceS({
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
    return withFollowUp(interaction)(
      pipe(
        botStateService.discordSetActivityFromDb(),
        Future.map(() => 'Activity refreshed'),
      ),
    )
  }

  /**
   * say
   */

  function onSay(interaction: ChatInputCommandInteraction): Future<NotUsed> {
    return withFollowUp(interaction)(
      pipe(
        apply.sequenceS(Either.Apply)({
          message: pipe(
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
        Future.chain(({ message, channel }) =>
          pipe(
            DiscordConnector.sendMessage(channel, message),
            Future.map(
              Maybe.fold(
                () =>
                  pipe(
                    // TODO: remove disable
                    // eslint-disable-next-line @typescript-eslint/no-base-to-string
                    logger.warn(`Couldn't say message in channel ${channel}`),
                    IO.map(() => 'Error'),
                  ),
                () => IO.right('Done'),
              ),
            ),
            Future.chain(Future.fromIOEither),
          ),
        ),
      ),
    )
  }

  /**
   * Helpers
   */

  function withFollowUp(
    interaction: ChatInputCommandInteraction,
  ): (f: Future<string>) => Future<NotUsed> {
    return f =>
      pipe(
        DiscordConnector.interactionDeferReply(interaction, { ephemeral: true }),
        Future.chain(() => f),
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

  function deleteMessage(message: Message): Future<NotUsed> {
    return pipe(
      DiscordConnector.messageDelete(message),
      Future.chainIOEitherK(deleted =>
        deleted
          ? IO.notUsed
          : LogUtils.pretty(logger, message.guild, message.author, message.channel).info(
              'Not enough permissions to delete message',
            ),
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
  autoroleMessages,
  defaultRole,
  itsFridayChannel,
  birthdayChannel,
  subscription,
}: GuildState): string =>
  StringUtils.stripMargins(
    `- **calls**: ${maybeStr(calls, formatCalls)}
    |- **autoroleMessages**: ${maybeStr(autoroleMessages, formatAutoroleMessages)}
    |- **defaultRole**: ${maybeStr(defaultRole)}
    |- **itsFridayChannel**: ${maybeStr(itsFridayChannel)}
    |- **birthdayChannel**: ${maybeStr(birthdayChannel)}
    |- **subscription**: ${maybeStr(subscription, s => s.stringify())}`,
  )

const formatCalls = ({ message, channel, role }: Calls): string =>
  // TODO: remove disable
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  `${role} - ${channel} - <${message.url}>`

const formatAutoroleMessages = (autoroleMessages: NonEmptyArray<__AutoroleMessage>): string =>
  pipe(
    autoroleMessages,
    NonEmptyArray.map(({ message, role }) => `  - ${role} - ${message.url}`),
    List.mkString('\n', '\n', ''),
  )

const formatActivity = ({ type, name }: Activity): string => `\`${type} ${name}\``

const decode = <A>(decoder: Decoder<unknown, A>, u: unknown): ValidatedNea<string, A> =>
  pipe(decoder.decode(u), Either.mapLeft(flow(D.draw, NonEmptyArray.of)))
