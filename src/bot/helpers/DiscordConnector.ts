import type { REST } from '@discordjs/rest'
import type {
  AudioPlayer,
  AudioPlayerStatus,
  PlayerSubscription,
  VoiceConnection,
  VoiceConnectionStatus,
} from '@discordjs/voice'
import { StreamType, createAudioResource } from '@discordjs/voice'
import { entersState as discordEntersState } from '@discordjs/voice'
import type { APIMessage, RESTPostAPIApplicationCommandsJSONBody } from 'discord-api-types/v9'
import { Routes } from 'discord-api-types/v9'
import type {
  ApplicationCommand,
  ApplicationCommandPermissions,
  BaseCommandInteraction,
  ButtonInteraction,
  Channel,
  ClientApplication,
  ClientPresence,
  Collection,
  Guild,
  GuildApplicationCommandPermissionData,
  GuildAuditLogsEntry,
  GuildMember,
  InteractionDeferReplyOptions,
  InteractionReplyOptions,
  InteractionUpdateOptions,
  Message,
  MessageComponentInteraction,
  MessageOptions,
  MessagePayload,
  PartialTextBasedChannelFields,
  Role,
  RoleResolvable,
  TextChannel,
  User,
} from 'discord.js'
import { Client, DiscordAPIError, Intents, MessageEmbed } from 'discord.js'
import type { Separated } from 'fp-ts/Separated'
import { flow, pipe } from 'fp-ts/function'
import * as D from 'io-ts/Decoder'

import { MsDuration } from '../../shared/models/MsDuration'
import { Either, Future, IO, List, Maybe } from '../../shared/utils/fp'

import type { ClientConfig } from '../Config'
import { Colors, constants } from '../constants'
import { GuildId } from '../models/GuildId'
import { TSnowflake } from '../models/TSnowflake'
import type { Activity } from '../models/botState/Activity'
import { CommandId } from '../models/commands/CommandId'
import { PutCommandResult } from '../models/commands/PutCommandResult'
import { ChannelUtils } from '../utils/ChannelUtils'
import { decodeError } from '../utils/decodeError'

type NotPartial = {
  readonly partial: false
}
type MyPartial<A extends NotPartial> =
  | {
      readonly partial: true
      readonly fetch: () => Promise<A>
    }
  | A

type MyInteraction = BaseCommandInteraction | MessageComponentInteraction

export type DiscordConnector = ReturnType<typeof of>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const of = (client: Client<true>) => ({
  client,

  /**
   * Read
   */

  fetchApplication: (): Future<ClientApplication> =>
    Future.tryCatch(() => client.application.fetch()),

  fetchChannel: (channelId: TSnowflake): Future<Maybe<Channel>> =>
    pipe(
      Future.tryCatch(() => client.channels.fetch(TSnowflake.unwrap(channelId))),
      Future.map(Maybe.fromNullable),
      // Future.orElse<Maybe<Channel>>(_ => Future.right(Maybe.none)),
      debugLeft('fetchChannel'),
      //   [
      //   e => e instanceof DiscordAPIError && e.message === 'Unknown Message',
      //   Maybe.none
      // ]
    ),

  fetchUser: (userId: TSnowflake): Future<Maybe<User>> =>
    pipe(
      IO.tryCatch(() => client.users.cache.get(TSnowflake.unwrap(userId))),
      IO.map(Maybe.fromNullable),
      Future.fromIOEither,
      Future.chain(
        Maybe.fold(
          () =>
            pipe(
              Future.tryCatch(() => client.users.fetch(TSnowflake.unwrap(userId))),
              Future.map(Maybe.some),
            ),
          flow(Maybe.some, Future.right),
        ),
      ),
      debugLeft('fetchUser'),
    ),

  getGuild: (guildId: GuildId): Maybe<Guild> =>
    Maybe.fromNullable(client.guilds.cache.get(GuildId.unwrap(guildId))),

  /**
   * Write
   */

  setActivity: (activity: Maybe<Activity>): IO<ClientPresence> =>
    IO.tryCatch(() =>
      pipe(
        activity,
        Maybe.fold(
          () => client.user.setActivity(),
          ({ name, type }) => client.user.setActivity(name, { type }),
        ),
      ),
    ),
})

/**
 * Read
 */

const fetchAuditLogs = (guild: Guild): Future<Collection<string, GuildAuditLogsEntry>> =>
  pipe(
    Future.tryCatch(() => guild.fetchAuditLogs({ limit: constants.fetchLogsLimit })),
    Future.map(logs => logs.entries),
  )

const fetchCommand = (guild: Guild, commandId: CommandId): Future<ApplicationCommand> =>
  Future.tryCatch(() => guild.commands.fetch(CommandId.unwrap(commandId)))

const fetchMember = (guild: Guild, memberId: TSnowflake): Future<Maybe<GuildMember>> =>
  pipe(
    Future.tryCatch(() => guild.members.fetch(TSnowflake.unwrap(memberId))),
    Future.map(Maybe.some),
    debugLeft('fetchMember'),
  )

const fetchMessage = (guild: Guild, messageId: TSnowflake): Future<Maybe<Message>> =>
  pipe(
    guild.channels.cache.toJSON(),
    List.filter(ChannelUtils.isTextChannel),
    fetchMessageRec(TSnowflake.unwrap(messageId)),
  )

const fetchPartial = <A extends NotPartial>(partial: MyPartial<A>): Future<A> =>
  partial.partial ? Future.tryCatch(() => partial.fetch()) : Future.right(partial)

const fetchRole = (guild: Guild, roleId: TSnowflake): Future<Maybe<Role>> =>
  pipe(
    Future.tryCatch(() => guild.roles.fetch(TSnowflake.unwrap(roleId))),
    Future.map(Maybe.fromNullable),
  )

const hasRole = (member: GuildMember, role: Role): boolean => member.roles.cache.has(role.id)

/**
 * Write
 */

const addRole = (
  member: GuildMember,
  roleOrRoles: RoleResolvable | List<RoleResolvable>,
  reason?: string,
): Future<boolean> =>
  pipe(
    Future.tryCatch(() => member.roles.add(roleOrRoles, reason)),
    Future.map(() => true),
    Future.orElse(e => (isMissingPermissionsError(e) ? Future.right(false) : Future.left(e))),
    debugLeft('addRole'),
  )

const connectionSubscribe = (
  connection: VoiceConnection,
  player: AudioPlayer,
): IO<Maybe<PlayerSubscription>> =>
  pipe(
    IO.tryCatch(() => connection.subscribe(player)),
    IO.map(Maybe.fromNullable),
  )

const deleteMessage = (message: Message): Future<boolean> =>
  pipe(
    Future.tryCatch(() => message.delete()),
    Future.map(() => true),
    Future.orElse(e => (isMissingPermissionsError(e) ? Future.right(false) : Future.left(e))),
  )

function entersState(
  target: VoiceConnection,
  status: VoiceConnectionStatus,
  timeout: MsDuration,
): Future<VoiceConnection>
function entersState(
  target: AudioPlayer,
  status: AudioPlayerStatus,
  timeout: MsDuration,
): Future<AudioPlayer>
function entersState(
  target: VoiceConnection | AudioPlayer,
  status: VoiceConnectionStatus | AudioPlayerStatus,
  timeout: MsDuration | MsDuration,
): Future<VoiceConnection | AudioPlayer> {
  return Future.tryCatch(() =>
    discordEntersState(
      target as VoiceConnection,
      status as VoiceConnectionStatus,
      MsDuration.unwrap(timeout),
    ),
  )
}

const guildCommandsPermissionsSet = (
  guild: Guild,
  fullPermissions: List<GuildApplicationCommandPermissionData>,
): Future<Collection<string, List<ApplicationCommandPermissions>>> =>
  Future.tryCatch(() =>
    guild.commands.permissions.set({
      // eslint-disable-next-line functional/prefer-readonly-type
      fullPermissions: fullPermissions as GuildApplicationCommandPermissionData[],
    }),
  )

const interactionDeferReply = (
  interaction: MyInteraction,
  options?: InteractionDeferReplyOptions,
): Future<void> => Future.tryCatch(() => interaction.deferReply(options))

const interactionDeleteReply = (interaction: MyInteraction): Future<void> =>
  Future.tryCatch(() => interaction.deleteReply())

const interactionEditReply = (
  interaction: MyInteraction,
  options: string | MessagePayload | InteractionReplyOptions,
): Future<APIMessage | Message> => Future.tryCatch(() => interaction.editReply(options))

const interactionFollowUp = (
  interaction: MyInteraction,
  options: string | MessagePayload | InteractionReplyOptions,
): Future<APIMessage | Message> => Future.tryCatch(() => interaction.followUp(options))

const interactionReply = (
  interaction: MyInteraction,
  options: string | MessagePayload | InteractionReplyOptions,
): Future<void> =>
  pipe(
    Future.tryCatch(() => interaction.reply(options)),
    Future.orElse(e =>
      isDiscordAPIError('Cannot send an empty message')(e) ? Future.unit : Future.left(e),
    ),
    debugLeft('interactionReply'),
  )

const interactionUpdate = (
  interaction: ButtonInteraction,
  options: string | MessagePayload | InteractionUpdateOptions,
): Future<void> => Future.tryCatch(() => interaction.update(options))

const messageEdit = (
  message: Message,
  options: string | MessagePayload | MessageOptions,
): Future<Message> => Future.tryCatch(() => message.edit(options))

const playerPlayArbitrary = (player: AudioPlayer, url: string): IO<void> =>
  pipe(
    IO.tryCatch(() => createAudioResource(url, { inputType: StreamType.Arbitrary })),
    IO.chain(resource => IO.tryCatch(() => player.play(resource))),
  )

const removeRole = (
  member: GuildMember,
  roleOrRoles: RoleResolvable | List<RoleResolvable>,
  reason?: string,
): Future<boolean> =>
  pipe(
    Future.tryCatch(() => member.roles.remove(roleOrRoles, reason)),
    Future.map(() => true),
    Future.orElse(e => (isMissingPermissionsError(e) ? Future.right(false) : Future.left(e))),
    debugLeft('removeRole'),
  )

const restPutApplicationGuildCommands = (
  rest: REST,
  clientId: string,
  guildId: GuildId,
  commands: List<RESTPostAPIApplicationCommandsJSONBody>,
): Future<Separated<ReadonlyArray<Error>, List<PutCommandResult>>> =>
  pipe(
    Future.tryCatch(() =>
      rest.put(Routes.applicationGuildCommands(clientId, GuildId.unwrap(guildId)), {
        body: commands,
      }),
    ),
    Future.chain(u =>
      pipe(
        D.UnknownArray.decode(u),
        Either.mapLeft(decodeError('UnknownArray')(u)),
        Future.fromEither,
      ),
    ),
    Future.map(
      List.partitionMap(u =>
        pipe(PutCommandResult.codec.decode(u), Either.mapLeft(decodeError('PutCommandResult')(u))),
      ),
    ),
  )

const sendMessage = (
  channel: PartialTextBasedChannelFields,
  options: string | MessagePayload | MessageOptions,
): Future<Maybe<Message>> =>
  pipe(
    Future.tryCatch(() => channel.send(options)),
    Future.map(Maybe.some),
    // Future.orElse<Maybe<Message>>(e =>
    //   e instanceof DiscordAPIError && e.message === 'Cannot send messages to this user'
    //     ? Future.right(Maybe.none)
    //     : Future.left(e),
    // ),
  )

const sendPrettyMessage = (
  channel: PartialTextBasedChannelFields,
  message: string,
  options: MessageOptions = {},
): Future<Maybe<Message>> =>
  sendMessage(channel, {
    ...options,
    embeds: [
      new MessageEmbed().setColor(Colors.darkred).setDescription(message),
      ...(options.embeds ?? []),
    ],
  })

/**
 * DiscordConnector
 */

export const DiscordConnector = {
  of,

  fetchAuditLogs,
  fetchCommand,
  fetchMember,
  fetchMessage,
  fetchPartial,
  fetchRole,
  hasRole,

  addRole,
  connectionSubscribe,
  deleteMessage,
  entersState,
  guildCommandsPermissionsSet,
  interactionDeferReply,
  interactionDeleteReply,
  interactionEditReply,
  interactionFollowUp,
  interactionReply,
  interactionUpdate,
  messageEdit,
  playerPlayArbitrary,
  removeRole,
  restPutApplicationGuildCommands,
  sendMessage,
  sendPrettyMessage,

  futureClient: (config: ClientConfig): Future<Client> =>
    Future.tryCatch(
      () =>
        new Promise<Client>(resolve => {
          const client = new Client({
            intents: [
              Intents.FLAGS.DIRECT_MESSAGES,
              Intents.FLAGS.GUILDS,
              Intents.FLAGS.GUILD_BANS,
              Intents.FLAGS.GUILD_MEMBERS,
              Intents.FLAGS.GUILD_MESSAGES,
              Intents.FLAGS.GUILD_VOICE_STATES,
            ],
            partials: ['USER', 'CHANNEL', 'GUILD_MEMBER', 'MESSAGE', 'REACTION'],
          })
          /* eslint-disable functional/no-expression-statement */
          client.once('ready', () => resolve(client))
          client.login(config.secret)
          /* eslint-enable functional/no-expression-statement */
        }),
    ),
}

/**
 * Helpers
 */

const isDiscordAPIError =
  (message: string) =>
  (e: Error): e is DiscordAPIError =>
    e instanceof DiscordAPIError && e.message === message

const isMissingPermissionsError = isDiscordAPIError('Missing Permissions')

const debugLeft = <A>(functionName: string): ((f: Future<A>) => Future<A>) =>
  Future.mapLeft(e => {
    const constr = Object.getPrototypeOf(e).contructor
    return Error(
      `"${functionName}"\n${nl(constr?.name)}${e.stack !== undefined ? e.stack : e.message}`,
    )
  })
const nl = (str: string | undefined): string => (str !== undefined ? `${str}\n` : '')

const fetchMessageRec =
  (message: string) =>
  (channels: List<TextChannel>): Future<Maybe<Message>> => {
    if (List.isNonEmpty(channels)) {
      const [head, ...tail] = channels
      return pipe(
        Future.tryCatch(() => head.messages.fetch(message)),
        Future.map(Maybe.some),
        Future.orElse(e =>
          isDiscordAPIError('Unknown Message')(e)
            ? Future.right<Maybe<Message>>(Maybe.none)
            : Future.left(e),
        ),
        Future.chain(
          Maybe.fold(() => fetchMessageRec(message)(tail), flow(Maybe.some, Future.right)),
        ),
      )
    }
    return Future.right(Maybe.none)
  }
