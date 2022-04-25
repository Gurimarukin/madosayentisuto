import type {
  APIInteractionDataResolvedChannel,
  APIInteractionGuildMember,
  APIRole,
} from 'discord-api-types/payloads/v9'
import { ChannelType } from 'discord-api-types/payloads/v9'
import type {
  CommandInteraction,
  Guild,
  GuildChannel,
  GuildMember,
  Message,
  TextBasedChannel,
  ThreadChannel,
} from 'discord.js'
import { Role, TextChannel, User } from 'discord.js'
import { apply } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'
import * as D from 'io-ts/Decoder'
import type { Decoder } from 'io-ts/Decoder'

import { ChannelId } from '../../../shared/models/ChannelId'
import { DiscordUserId } from '../../../shared/models/DiscordUserId'
import { ValidatedNea } from '../../../shared/models/ValidatedNea'
import { StringUtils } from '../../../shared/utils/StringUtils'
import { toUnit } from '../../../shared/utils/fp'
import { IO } from '../../../shared/utils/fp'
import { Either, NonEmptyArray } from '../../../shared/utils/fp'
import { Future, List, Maybe } from '../../../shared/utils/fp'
import { futureMaybe } from '../../../shared/utils/futureMaybe'

import { DiscordConnector } from '../../helpers/DiscordConnector'
import { initCallsMessage } from '../../helpers/messages/initCallsMessage'
import { Command } from '../../models/Command'
import { RoleId } from '../../models/RoleId'
import type { Activity } from '../../models/botState/Activity'
import { ActivityTypeBot } from '../../models/botState/ActivityTypeBot'
import { MadEvent } from '../../models/event/MadEvent'
import type { Calls } from '../../models/guildState/Calls'
import type { GuildState } from '../../models/guildState/GuildState'
import type { LoggerGetter } from '../../models/logger/LoggerGetter'
import { ObserverWithRefinement } from '../../models/rx/ObserverWithRefinement'
import type { BotStateService } from '../../services/BotStateService'
import type { GuildStateService } from '../../services/GuildStateService'
import { ChannelUtils } from '../../utils/ChannelUtils'
import { LogUtils } from '../../utils/LogUtils'

const Keys = {
  state: 'state',
  calls: 'calls',
  init: 'init',
  channel: 'channel',
  role: 'role',
  defaultrole: 'defaultrole',
  itsfriday: 'itsfriday',
  birthday: 'birthday',
  activity: 'activity',
  type: 'type',
  name: 'name',
  refresh: 'refresh',
  get: 'get',
  set: 'set',
  unset: 'unset',
}

const stateCommand = Command.chatInput({
  name: Keys.state,
  description: "Dans quel état j'erre ?",
  default_permission: false,
})(
  Command.option.subCommand({
    name: Keys.get,
    description: 'État de Jean Plank pour ce serveur',
  })(),
)

/**
 * Jean Plank envoie un message dans le salon où la commande a été effectuée.
 * Les membres d'équipage qui y réagissent avec 🔔 obtiennent le rôle <role>.
 * À la suite de quoi, lorsqu'un appel commence sur le serveur, ils seront notifiés dans le salon <channel> en étant mentionné par le rôle <role>.`
 */
const callsCommand = Command.chatInput({
  name: Keys.calls,
  description: "Jean Plank n'est pas votre secrétaire, mais il gère vos appels",
  default_permission: false,
})(
  Command.option.subCommand({
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
)

const defaultRoleCommand = Command.chatInput({
  name: Keys.defaultrole,
  description: "Jean Plank donne un rôle au nouveau membres d'équipages",
  default_permission: false,
})(
  Command.option.subCommand({
    name: Keys.set,
    description: 'Jean Plank veut bien changer le rôle par défaut de ce serveur',
  })(
    Command.option.role({
      name: Keys.role,
      description: 'Le nouveau rôle par défaut',
      required: true,
    }),
  ),
)

const itsFridayCommand = Command.chatInput({
  name: Keys.itsfriday,
  description: "Jean Plank vous informe que nous sommes vendredi (c'est vrai)",
  default_permission: false,
})(
  Command.option.subCommand({
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
)

const birthdayCommand = Command.chatInput({
  name: Keys.birthday,
  description: "Jean Plank vous informe que c'est l'anniversaire de bidule",
  default_permission: false,
})(
  Command.option.subCommand({
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
)

const activityCommand = Command.chatInput({
  name: Keys.activity,
  description: 'Jean Plank est un captaine occupé et le fait savoir',
  default_permission: false,
})(
  Command.option.subCommand({
    name: Keys.get,
    description: "Jean Plank vous informe de ce qu'il est en train de faire",
  })(),
  Command.option.subCommand({
    name: Keys.unset,
    description: "Jean Plank a fini ce qu'il était en train de faire",
  })(),
  Command.option.subCommand({
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
  Command.option.subCommand({
    name: Keys.refresh,
    description: 'Jean Plank a parfois besoin de rappeler au monde à quel point il est occupé',
  })(),
)

export const adminCommands = [
  stateCommand,
  callsCommand,
  defaultRoleCommand,
  itsFridayCommand,
  birthdayCommand,
  activityCommand,
]

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const AdminCommandsObserver = (
  Logger: LoggerGetter,
  discord: DiscordConnector,
  botStateService: BotStateService,
  guildStateService: GuildStateService,
) => {
  const logger = Logger('AdminCommandsObserver')

  return ObserverWithRefinement.fromNext(
    MadEvent,
    'InteractionCreate',
  )(event => {
    const interaction = event.interaction

    if (!interaction.isCommand()) return Future.unit

    switch (interaction.commandName) {
      case Keys.state:
        return onState(interaction)
      case Keys.calls:
        return onCalls(interaction)
      case Keys.defaultrole:
        return onDefaultRole(interaction)
      case Keys.itsfriday:
        return onItsFriday(interaction)
      case Keys.birthday:
        return onBirthday(interaction)
      case Keys.activity:
        return onActivity(interaction)
    }

    return Future.unit
  })

  /**
   * state
   */

  function onState(interaction: CommandInteraction): Future<void> {
    switch (interaction.options.getSubcommand(false)) {
      case Keys.get:
        return onStateGet(interaction)
    }
    return Future.unit
  }

  function onStateGet(interaction: CommandInteraction): Future<void> {
    return pipe(
      DiscordConnector.interactionDeferReply(interaction, { ephemeral: true }),
      Future.map(() => Maybe.fromNullable(interaction.guild)),
      futureMaybe.chainTaskEitherK(guild => guildStateService.getState(guild)),
      futureMaybe.match(() => 'Rien à montrer pour ce serveur', formatState),
      Future.chain(content =>
        DiscordConnector.interactionFollowUp(interaction, { content, ephemeral: true }),
      ),
      Future.map(toUnit),
    )
  }

  /**
   * calls
   */

  function onCalls(interaction: CommandInteraction): Future<void> {
    switch (interaction.options.getSubcommand(false)) {
      case Keys.init:
        return onCallsInit(interaction)
    }
    return Future.unit
  }

  function onCallsInit(interaction: CommandInteraction): Future<void> {
    const maybeGuild = Maybe.fromNullable(interaction.guild)
    return pipe(
      DiscordConnector.interactionReply(interaction, { content: '...', ephemeral: false }),
      Future.chain(() => DiscordConnector.interactionDeleteReply(interaction)),
      Future.chain(() =>
        apply.sequenceS(futureMaybe.ApplyPar)({
          guild: Future.right(maybeGuild),
          author: fetchUser(Maybe.fromNullable(interaction.member)),
          commandChannel: futureMaybe.fromNullable(interaction.channel),
          callsChannel: fetchChannel(
            Maybe.fromNullable(interaction.options.getChannel(Keys.channel)),
          ),
          role: fetchRole(maybeGuild, Maybe.fromNullable(interaction.options.getRole(Keys.role))),
        }),
      ),
      futureMaybe.chainTaskEitherK(({ guild, author, commandChannel, callsChannel, role }) =>
        sendInitMessageAndUpdateState(guild, author, commandChannel, callsChannel, role),
      ),
      Future.map(toUnit),
    )
  }

  function sendInitMessageAndUpdateState(
    guild: Guild,
    author: User,
    commandChannel: TextBasedChannel,
    channel: TextChannel,
    role: Role,
  ): Future<void> {
    return pipe(
      sendInitMessage(commandChannel, channel, role),
      futureMaybe.matchE(
        () =>
          ChannelUtils.isNamedChannel(commandChannel)
            ? pipe(
                DiscordConnector.sendPrettyMessage(
                  author,
                  `Impossible d'envoyer le message d'abonnement dans le salon **#${commandChannel.name}**.`,
                ),
                Future.map(toUnit),
              )
            : Future.unit,
        tryDeletePreviousMessageAndSetCalls(guild, channel, role),
      ),
    )
  }

  function sendInitMessage(
    commandChannel: TextBasedChannel,
    callsChannel: ThreadChannel | APIInteractionDataResolvedChannel | GuildChannel,
    role: Role | APIRole,
  ): Future<Maybe<Message>> {
    return DiscordConnector.sendMessage(commandChannel, initCallsMessage(callsChannel, role))
  }

  function tryDeletePreviousMessageAndSetCalls(
    guild: Guild,
    channel: TextChannel,
    role: Role,
  ): (message: Message) => Future<void> {
    return message =>
      pipe(
        guildStateService.getCalls(guild),
        futureMaybe.chainTaskEitherK(previous => deleteMessage(previous.message)),
        Future.chain(() => guildStateService.setCalls(guild, { message, channel, role })),
        Future.map(toUnit),
      )
  }

  /**
   * defaultrole
   */

  function onDefaultRole(interaction: CommandInteraction): Future<void> {
    switch (interaction.options.getSubcommand(false)) {
      case Keys.set:
        return onDefaultRoleSet(interaction)
    }
    return Future.unit
  }

  function onDefaultRoleSet(interaction: CommandInteraction): Future<void> {
    return withFollowUp(interaction)(
      pipe(
        apply.sequenceS(futureMaybe.ApplyPar)({
          guild: Future.right(Maybe.fromNullable(interaction.guild)),
          role: fetchRole(
            Maybe.fromNullable(interaction.guild),
            Maybe.fromNullable(interaction.options.getRole(Keys.role)),
          ),
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

  function onItsFriday(interaction: CommandInteraction): Future<void> {
    switch (interaction.options.getSubcommand(false)) {
      case Keys.set:
        return onItsFridaySet(interaction)
    }
    return Future.unit
  }

  function onItsFridaySet(interaction: CommandInteraction): Future<void> {
    return withFollowUp(interaction)(
      pipe(
        apply.sequenceS(futureMaybe.ApplyPar)({
          guild: Future.right(Maybe.fromNullable(interaction.guild)),
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

  function onBirthday(interaction: CommandInteraction): Future<void> {
    switch (interaction.options.getSubcommand(false)) {
      case Keys.set:
        return onBirthdaySet(interaction)
    }
    return Future.unit
  }

  function onBirthdaySet(interaction: CommandInteraction): Future<void> {
    return withFollowUp(interaction)(
      pipe(
        apply.sequenceS(futureMaybe.ApplyPar)({
          guild: Future.right(Maybe.fromNullable(interaction.guild)),
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

  function onActivity(interaction: CommandInteraction): Future<void> {
    switch (interaction.options.getSubcommand(false)) {
      case Keys.get:
        return onActivityGet(interaction)
      case Keys.unset:
        return onActivityUnset(interaction)
      case Keys.set:
        return onActivitySet(interaction)
      case Keys.refresh:
        return onActivityRefresh(interaction)
    }
    return Future.unit
  }

  function onActivityGet(interaction: CommandInteraction): Future<void> {
    return withFollowUp(interaction)(
      pipe(
        botStateService.find(),
        Future.map(({ activity }) => activity),
        futureMaybe.match(() => 'No activity', formatActivity),
      ),
    )
  }

  function onActivityUnset(interaction: CommandInteraction): Future<void> {
    return withFollowUp(interaction)(
      pipe(
        botStateService.unsetActivity(),
        Future.map(() => 'Activity unset'),
      ),
    )
  }

  function onActivitySet(interaction: CommandInteraction): Future<void> {
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

  function onActivityRefresh(interaction: CommandInteraction): Future<void> {
    return withFollowUp(interaction)(
      pipe(
        botStateService.discordSetActivityFromDb(),
        Future.map(() => 'Activity refreshed'),
      ),
    )
  }

  /**
   * Helpers
   */

  function withFollowUp(interaction: CommandInteraction): (f: Future<string>) => Future<void> {
    return f =>
      pipe(
        DiscordConnector.interactionDeferReply(interaction, { ephemeral: true }),
        Future.chain(() => f),
        Future.chain(content =>
          DiscordConnector.interactionFollowUp(interaction, { content, ephemeral: true }),
        ),
        Future.map(toUnit),
      )
  }

  function fetchUser(
    maybeMember: Maybe<GuildMember | APIInteractionGuildMember>,
  ): Future<Maybe<User>> {
    return pipe(
      futureMaybe.fromOption(maybeMember),
      futureMaybe.chain(({ user }) =>
        user instanceof User
          ? Future.right(Maybe.some(user))
          : discord.fetchUser(DiscordUserId.fromUser(user)),
      ),
    )
  }

  function fetchChannel(
    maybeChannel: Maybe<ThreadChannel | APIInteractionDataResolvedChannel | GuildChannel>,
  ): Future<Maybe<TextChannel>> {
    return pipe(
      futureMaybe.fromOption(maybeChannel),
      futureMaybe.chain(channel =>
        channel instanceof TextChannel
          ? Future.right(Maybe.some(channel))
          : pipe(
              discord.fetchChannel(ChannelId.fromChannel(channel)),
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
      futureMaybe.fromOption,
      futureMaybe.chain(({ guild, role }) =>
        role instanceof Role
          ? Future.right(Maybe.some(role))
          : DiscordConnector.fetchRole(guild, RoleId.fromRole(role)),
      ),
    )
  }

  function deleteMessage(message: Message): Future<void> {
    return pipe(
      DiscordConnector.messageDelete(message),
      Future.chainIOEitherK(deleted =>
        deleted
          ? IO.unit
          : LogUtils.pretty(logger, message.guild, message.author, message.channel).info(
              'Not enough permissions to delete message',
            ),
      ),
    )
  }
}

const maybeStr = <A>(fa: Maybe<A>, str: (a: A) => string = String): string =>
  pipe(fa, Maybe.map(str), Maybe.toNullable, String)

const formatState = ({
  calls,
  defaultRole,
  itsFridayChannel,
  birthdayChannel,
  subscription,
}: GuildState): string =>
  StringUtils.stripMargins(
    `- **calls**: ${maybeStr(calls, formatCalls)}
    |- **defaultRole**: ${maybeStr(defaultRole)}
    |- **itsFridayChannel**: ${maybeStr(itsFridayChannel)}
    |- **birthdayChannel**: ${maybeStr(birthdayChannel)}
    |- **subscription**: ${maybeStr(subscription, s => s.stringify())}`,
  )

const formatCalls = ({ message, channel, role }: Calls): string =>
  `${role} - ${channel} - <${message.url}>`

const formatActivity = ({ type, name }: Activity): string => `\`${type} ${name}\``

const decode = <A>(decoder: Decoder<unknown, A>, u: unknown): ValidatedNea<string, A> =>
  pipe(decoder.decode(u), Either.mapLeft(flow(D.draw, NonEmptyArray.of)))
