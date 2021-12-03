import { SlashCommandBuilder, inlineCode } from '@discordjs/builders'
import type {
  APIInteractionDataResolvedChannel,
  APIRole,
  APIUser,
} from 'discord-api-types/payloads/v9'
import { ChannelType } from 'discord-api-types/payloads/v9'
import type {
  CommandInteraction,
  Guild,
  GuildChannel,
  Message,
  TextBasedChannels,
  ThreadChannel,
} from 'discord.js'
import { Role, TextChannel, User } from 'discord.js'
import { apply } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'
import * as D from 'io-ts/Decoder'

import { futureMaybe } from '../../../shared/utils/FutureMaybe'
import type { Tuple } from '../../../shared/utils/fp'
import { IO } from '../../../shared/utils/fp'
import { Either, NonEmptyArray } from '../../../shared/utils/fp'
import { Future, List, Maybe } from '../../../shared/utils/fp'

import { DiscordConnector } from '../../helpers/DiscordConnector'
import { getInitCallsMessage } from '../../helpers/getInitCallsMessage'
import { TSnowflake } from '../../models/TSnowflake'
import { ValidatedNea } from '../../models/ValidatedNea'
import type { Activity } from '../../models/botState/Activity'
import { ActivityTypeBot } from '../../models/botState/ActivityTypeBot'
import type { MadEventInteractionCreate } from '../../models/events/MadEvent'
import type { Calls } from '../../models/guildState/Calls'
import type { GuildState } from '../../models/guildState/GuildState'
import type { LoggerGetter } from '../../models/logger/LoggerType'
import type { TObserver } from '../../models/rx/TObserver'
import type { BotStateService } from '../../services/BotStateService'
import type { GuildStateService } from '../../services/GuildStateService'
import { ChannelUtils } from '../../utils/ChannelUtils'
import { LogUtils } from '../../utils/LogUtils'
import { StringUtils } from '../../utils/StringUtils'

const stateCommand = new SlashCommandBuilder()
  .setDefaultPermission(false)
  .setName('state')
  .setDescription("Dans quel état j'erre ?")
  .addSubcommand(subcommand =>
    subcommand.setName('get').setDescription('État de Jean Plank pour ce serveur'),
  )
const callsCommand = new SlashCommandBuilder()
  .setDefaultPermission(false)
  .setName('calls')
  .setDescription("Jean Plank n'est pas votre secrétaire, mais il gère vos appels")
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
          .setDescription('Le salon dans lequel les appels seront notifiés')
          .addChannelTypes([ChannelType.GuildText])
          .setRequired(true),
      )
      .addRoleOption(option =>
        option
          .setName('role')
          .setDescription('Le rôle qui sera notifié des appels')
          .setRequired(true),
      ),
  )

const defaultRoleCommand = new SlashCommandBuilder()
  .setDefaultPermission(false)
  .setName('defaultrole')
  .setDescription("Jean Plank donne un rôle au nouveau membres d'équipages")
  .addSubcommand(subcommand =>
    subcommand
      .setName('set')
      .setDescription('Jean Plank veut bien changer le rôle par défaut de ce serveur')
      .addRoleOption(option =>
        option.setName('role').setDescription('Le nouveau rôle par défaut').setRequired(true),
      ),
  )

const itsFridayCommand = new SlashCommandBuilder()
  .setDefaultPermission(false)
  .setName('itsfriday')
  .setDescription("Jean Plank vous informe que nous sommes vendredi (c'est vrai)")
  .addSubcommand(subcommand =>
    subcommand
      .setName('set')
      .setDescription('Jean Plank veut bien changer le salon pour cette information vitale')
      .addChannelOption(option =>
        option
          .setName('channel')
          .setDescription('Le nouveau salon pour cette information vitale')
          .addChannelTypes([ChannelType.GuildText])
          .setRequired(true),
      ),
  )

const activityTypeBotChoices: List<Tuple<ActivityTypeBot, ActivityTypeBot>> = pipe(
  ActivityTypeBot.values,
  List.map(a => [a, a]),
)
const activityCommand = new SlashCommandBuilder()
  .setDefaultPermission(false)
  .setName('activity')
  .setDescription('Jean Plank est un captaine occupé et le fait savoir')
  .addSubcommand(subcommand =>
    subcommand
      .setName('get')
      .setDescription("Jean Plank vous informe de ce qu'il est en train de faire"),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('unset')
      .setDescription("Jean Plank a fini ce qu'il était en train de faire"),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('set')
      .setDescription("Jean Plank annonce au monde ce qu'il est en train de faire")
      .addStringOption(option =>
        option
          .setName('type')
          .setDescription("Le type d'activité que Jean Plank est en train de faire")
          // eslint-disable-next-line functional/prefer-readonly-type
          .addChoices(activityTypeBotChoices as [ActivityTypeBot, ActivityTypeBot][])
          .setRequired(true),
      )
      .addStringOption(option =>
        option
          .setName('name')
          .setDescription("L'activité que Jean Plank est en train de faire")
          .setRequired(true),
      ),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('refresh')
      .setDescription(
        'Jean Plank a parfois besoin de rappeler au monde à quel point il est occupé',
      ),
  )

export const adminCommands = [
  stateCommand,
  callsCommand,
  defaultRoleCommand,
  itsFridayCommand,
  activityCommand,
]

export const AdminCommandsObserver = (
  Logger: LoggerGetter,
  discord: DiscordConnector,
  botStateService: BotStateService,
  guildStateService: GuildStateService,
): TObserver<MadEventInteractionCreate> => {
  const logger = Logger('AdminCommandsObserver')

  return {
    next: event => {
      const interaction = event.interaction

      if (!interaction.isCommand()) return Future.unit

      switch (interaction.commandName) {
        case 'state':
          return onState(interaction)
        case 'calls':
          return onCalls(interaction)
        case 'defaultrole':
          return onDefaultRole(interaction)
        case 'itsfriday':
          return onItsFriday(interaction)
        case 'activity':
          return onActivity(interaction)
      }

      return Future.unit
    },
  }

  /**
   * state
   */

  function onState(interaction: CommandInteraction): Future<void> {
    switch (interaction.options.getSubcommand(false)) {
      case 'get':
        return onStateGet(interaction)
    }
    return Future.unit
  }

  function onStateGet(interaction: CommandInteraction): Future<void> {
    return pipe(
      DiscordConnector.interactionDeferReply(interaction, { ephemeral: true }),
      Future.map(() => Maybe.fromNullable(interaction.guild)),
      futureMaybe.chainFuture(guild => guildStateService.getState(guild)),
      futureMaybe.match(() => 'Rien à montrer pour ce serveur', formatState),
      Future.chain(content =>
        DiscordConnector.interactionFollowUp(interaction, { content, ephemeral: true }),
      ),
      Future.map(() => {}),
    )
  }

  /**
   * calls
   */

  function onCalls(interaction: CommandInteraction): Future<void> {
    switch (interaction.options.getSubcommand(false)) {
      case 'init':
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
          author: fetchUser(interaction.member.user),
          commandChannel: futureMaybe.fromNullable(interaction.channel),
          callsChannel: fetchChannel(Maybe.fromNullable(interaction.options.getChannel('channel'))),
          role: fetchRole(maybeGuild, Maybe.fromNullable(interaction.options.getRole('role'))),
        }),
      ),
      futureMaybe.chainFuture(({ guild, author, commandChannel, callsChannel, role }) =>
        sendInitMessageAndUpdateState(guild, author, commandChannel, callsChannel, role),
      ),
      Future.map(() => {}),
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
      futureMaybe.matchE(
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
    )
  }

  function sendInitMessage(
    commandChannel: TextBasedChannels,
    callsChannel: ThreadChannel | APIInteractionDataResolvedChannel | GuildChannel,
    role: Role | APIRole,
  ): Future<Maybe<Message>> {
    return DiscordConnector.sendMessage(commandChannel, getInitCallsMessage(callsChannel, role))
  }

  function tryDeletePreviousMessageAndSetCalls(
    guild: Guild,
    channel: TextChannel,
    role: Role,
  ): (message: Message) => Future<void> {
    return message =>
      pipe(
        guildStateService.getCalls(guild),
        futureMaybe.chainFuture(previous => deleteMessage(previous.message)),
        Future.chain(() => guildStateService.setCalls(guild, { message, channel, role })),
        Future.map(() => {}),
      )
  }

  /**
   * defaultrole
   */

  function onDefaultRole(interaction: CommandInteraction): Future<void> {
    switch (interaction.options.getSubcommand(false)) {
      case 'set':
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
            Maybe.fromNullable(interaction.options.getRole('role')),
          ),
        }),
        futureMaybe.chainFuture(({ guild, role }) => guildStateService.setDefaultRole(guild, role)),
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
      case 'set':
        return onItsFridaySet(interaction)
    }
    return Future.unit
  }

  function onItsFridaySet(interaction: CommandInteraction): Future<void> {
    return withFollowUp(interaction)(
      pipe(
        apply.sequenceS(futureMaybe.ApplyPar)({
          guild: Future.right(Maybe.fromNullable(interaction.guild)),
          channel: fetchChannel(Maybe.fromNullable(interaction.options.getChannel('channel'))),
        }),
        futureMaybe.chainFuture(({ guild, channel }) =>
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
   * activity
   */

  function onActivity(interaction: CommandInteraction): Future<void> {
    switch (interaction.options.getSubcommand(false)) {
      case 'get':
        return onActivityGet(interaction)
      case 'unset':
        return onActivityUnset(interaction)
      case 'set':
        return onActivitySet(interaction)
      case 'refresh':
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
          type: decode(ActivityTypeBot.decoder, interaction.options.getString('type')),
          name: decode(D.string, interaction.options.getString('name')),
        }),
        Either.mapLeft(
          flow(
            StringUtils.mkString('Invalid options from command "activity set":\n', '\n', ''),
            Error,
          ),
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
      futureMaybe.fromOption(maybeChannel),
      futureMaybe.chain(channel =>
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
      futureMaybe.fromOption,
      futureMaybe.chain(({ guild, role }) =>
        role instanceof Role
          ? Future.right(Maybe.some(role))
          : DiscordConnector.fetchRole(guild, TSnowflake.wrap(role.id)),
      ),
    )
  }

  function deleteMessage(message: Message): Future<void> {
    return pipe(
      DiscordConnector.messageDelete(message),
      Future.chainIOEitherK(deleted =>
        deleted
          ? IO.unit
          : LogUtils.pretty(
              logger,
              message.guild,
              message.author,
              message.channel,
            )('info', 'Not enough permissions to delete message'),
      ),
    )
  }
}

const maybeStr = <A>(fa: Maybe<A>, str: (a: A) => string = String): string =>
  pipe(fa, Maybe.map(str), Maybe.toNullable, String)

const formatState = ({ calls, defaultRole, itsFridayChannel, subscription }: GuildState): string =>
  StringUtils.stripMargins(
    `- **calls**: ${maybeStr(calls, formatCalls)}
    |- **defaultRole**: ${maybeStr(defaultRole)}
    |- **itsFridayChannel**: ${maybeStr(itsFridayChannel)}
    |- **subscription**: ${maybeStr(subscription, s => s.stringify())}`,
  )

const formatCalls = ({ message, channel, role }: Calls): string =>
  `${role} - ${channel} - <${message.url}>`

const formatActivity = ({ type, name }: Activity): string => inlineCode(`${type} ${name}`)

const decode = <A>(decoder: D.Decoder<unknown, A>, u: unknown): ValidatedNea<string, A> =>
  pipe(decoder.decode(u), Either.mapLeft(flow(D.draw, NonEmptyArray.of)))
