import type { REST } from '@discordjs/rest'
import type {
  AudioPlayer,
  AudioPlayerStatus,
  AudioResource,
  PlayerSubscription,
  VoiceConnection,
  VoiceConnectionStatus,
} from '@discordjs/voice'
import { createAudioPlayer, joinVoiceChannel } from '@discordjs/voice'
import { entersState as discordEntersState } from '@discordjs/voice'
import type { APIMessage, RESTPostAPIApplicationCommandsJSONBody } from 'discord-api-types/v9'
import { Routes } from 'discord-api-types/v9'
import type {
  AllowedThreadTypeForNewsChannel,
  AllowedThreadTypeForTextChannel,
  AnyChannel,
  ApplicationCommand,
  ApplicationCommandPermissions,
  BaseCommandInteraction,
  ButtonInteraction,
  ClientApplication,
  ClientPresence,
  Collection,
  Guild,
  GuildApplicationCommandPermissionData,
  GuildAuditLogsEntry,
  GuildAuditLogsFetchOptions,
  GuildAuditLogsResolvable,
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
  StageChannel,
  StartThreadOptions,
  TextChannel,
  ThreadChannel,
  ThreadCreateOptions,
  ThreadManager,
  User,
  VoiceChannel,
} from 'discord.js'
import { Client, DiscordAPIError, Intents } from 'discord.js'
import type { Separated } from 'fp-ts/Separated'
import { flow, pipe } from 'fp-ts/function'
import * as D from 'io-ts/Decoder'

import { MsDuration } from '../../shared/models/MsDuration'
import { GuildId } from '../../shared/models/guild/GuildId'
import { futureMaybe } from '../../shared/utils/FutureMaybe'
import { Either, Future, IO, List, Maybe } from '../../shared/utils/fp'
import { decodeError } from '../../shared/utils/ioTsUtils'

import type { ClientConfig } from '../Config'
import { Colors, constants } from '../constants'
import { TSnowflake } from '../models/TSnowflake'
import type { Activity } from '../models/botState/Activity'
import { CommandId } from '../models/commands/CommandId'
import { PutCommandResult } from '../models/commands/PutCommandResult'
import { ChannelUtils } from '../utils/ChannelUtils'
import { MessageUtils } from '../utils/MessageUtils'

type MyPartial<A> = {
  readonly partial: boolean
  readonly fetch: () => Promise<A>
}

type MyInteraction = BaseCommandInteraction | MessageComponentInteraction

type MyThreadChannelTypes = AllowedThreadTypeForNewsChannel | AllowedThreadTypeForTextChannel
type MyThreadCreateOptions<A extends MyThreadChannelTypes> = Omit<
  ThreadCreateOptions<A>,
  'type'
> & {
  readonly type?: A
}

export type DiscordConnector = ReturnType<typeof of>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const of = (client: Client<true>) => ({
  client,

  /**
   * Read
   */

  fetchApplication: (): Future<ClientApplication> =>
    pipe(
      Future.tryCatch(() => client.application.fetch()),
      debugLeft('fetchApplication'),
    ),

  fetchChannel: (channelId: TSnowflake): Future<Maybe<AnyChannel>> =>
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
      futureMaybe.alt(() =>
        pipe(
          Future.tryCatch(() => client.users.fetch(TSnowflake.unwrap(userId))),
          Future.map(Maybe.some),
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

const fetchAuditLogs = <A extends GuildAuditLogsResolvable = 'ALL'>(
  guild: Guild,
  options?: Omit<GuildAuditLogsFetchOptions<A>, 'limit'>,
): Future<Collection<string, GuildAuditLogsEntry<A>>> =>
  pipe(
    Future.tryCatch(() => guild.fetchAuditLogs<A>({ ...options, limit: constants.fetchLogsLimit })),
    Future.map(logs => logs.entries),
    debugLeft('fetchAuditLogs'),
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
    debugLeft('fetchMessage'),
  )

const fetchPartial = <A extends MyPartial<A>>(partial: A): Future<A> =>
  partial.partial
    ? pipe(
        Future.tryCatch(() => partial.fetch()),
        debugLeft('fetchPartial'),
      )
    : Future.right(partial)

const fetchRole = (guild: Guild, roleId: TSnowflake): Future<Maybe<Role>> =>
  pipe(
    Future.tryCatch(() => guild.roles.fetch(TSnowflake.unwrap(roleId))),
    Future.map(Maybe.fromNullable),
    debugLeft('fetchRole'),
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

const audioPlayerCreate: IO<AudioPlayer> = IO.tryCatch(() => createAudioPlayer())

const audioPlayerPause = (audioPlayer: AudioPlayer): IO<boolean> =>
  IO.tryCatch(() => audioPlayer.pause())

const audioPlayerPlayAudioResource = (
  audioPlayer: AudioPlayer,
  audioResource: AudioResource,
): IO<void> => IO.tryCatch(() => audioPlayer.play(audioResource))

const audioPlayerStop = (audioPlayer: AudioPlayer): IO<boolean> =>
  IO.tryCatch(() => audioPlayer.stop(true))

const audioPlayerUnpause = (audioPlayer: AudioPlayer): IO<boolean> =>
  IO.tryCatch(() => audioPlayer.unpause())

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
  pipe(
    Future.tryCatch(() =>
      guild.commands.permissions.set({
        // eslint-disable-next-line functional/prefer-readonly-type
        fullPermissions: fullPermissions as GuildApplicationCommandPermissionData[],
      }),
    ),
    debugLeft('guildCommandsPermissionsSet'),
  )

const interactionDeferReply = (
  interaction: MyInteraction,
  options?: InteractionDeferReplyOptions,
): Future<void> =>
  pipe(
    Future.tryCatch(() => interaction.deferReply(options)),
    debugLeft('interactionDeferReply'),
  )

const interactionDeleteReply = (interaction: MyInteraction): Future<void> =>
  pipe(
    Future.tryCatch(() => interaction.deleteReply()),
    debugLeft('interactionDeleteReply'),
  )

const interactionEditReply = (
  interaction: MyInteraction,
  options: string | MessagePayload | InteractionReplyOptions,
): Future<APIMessage | Message> =>
  pipe(
    Future.tryCatch(() => interaction.editReply(options)),
    debugLeft('interactionEditReply'),
  )

const interactionFollowUp = (
  interaction: MyInteraction,
  options: string | MessagePayload | InteractionReplyOptions,
): Future<APIMessage | Message> =>
  pipe(
    Future.tryCatch(() => interaction.followUp(options)),
    debugLeft('interactionFollowUp'),
  )

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
  options: string | MessagePayload | InteractionUpdateOptions = {},
): Future<void> =>
  pipe(
    Future.tryCatch(() => interaction.update(options)),
    debugLeft('interactionUpdate'),
  )

const messageDelete = (message: Message): Future<boolean> =>
  pipe(
    Future.tryCatch(() => message.delete()),
    Future.map(() => true),
    Future.orElse(e =>
      isMissingPermissionsError(e) || isUnknownMessageError(e)
        ? Future.right(false)
        : Future.left(e),
    ),
    debugLeft('messageDelete'),
  )

const messageEdit = (
  message: Message,
  options: string | MessagePayload | MessageOptions,
): Future<Message> =>
  pipe(
    Future.tryCatch(() => message.edit(options)),
    debugLeft('messageEdit'),
  )

const messageStartThread = (message: Message, options: StartThreadOptions): Future<ThreadChannel> =>
  pipe(
    Future.tryCatch(() => message.startThread(options)),
    debugLeft('messageStartThread'),
  )

const roleRemove = (
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
    debugLeft('restPutApplicationGuildCommands'),
  )

const sendMessage = (
  channel: PartialTextBasedChannelFields,
  options: string | MessagePayload | MessageOptions,
): Future<Maybe<Message>> =>
  pipe(
    Future.tryCatch(() => channel.send(options)),
    Future.map(Maybe.some),
    debugLeft('sendMessage'),
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
    embeds: [MessageUtils.safeEmbed({ color: Colors.darkred, description: message })],
  })

const threadsCreate = <A extends MyThreadChannelTypes>(
  threads: ThreadManager<A>,
  options: MyThreadCreateOptions<A>,
): Future<Maybe<ThreadChannel>> =>
  pipe(
    Future.tryCatch(() => threads.create(options)),
    Future.map(Maybe.some),
    debugLeft('threadsCreate'),
  )

const threadDelete = (thread: ThreadChannel): Future<boolean> =>
  pipe(
    Future.tryCatch(() => thread.delete()),
    Future.map(() => true),
    Future.orElse(e =>
      isMissingPermissionsError(e) || isUnknownMessageError(e)
        ? Future.right(false)
        : Future.left(e),
    ),
    debugLeft('threadDelete'),
  )

const voiceConnectionDestroy = (connection: VoiceConnection): IO<void> =>
  IO.tryCatch(() => connection.destroy())

const voiceConnectionJoin = (channel: VoiceChannel | StageChannel): IO<VoiceConnection> =>
  IO.tryCatch(() =>
    joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
    }),
  )

const voiceConnectionSubscribe = (
  connection: VoiceConnection,
  player: AudioPlayer,
): IO<Maybe<PlayerSubscription>> =>
  pipe(
    IO.tryCatch(() => connection.subscribe(player)),
    IO.map(Maybe.fromNullable),
  )

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
  audioPlayerCreate,
  audioPlayerPause,
  audioPlayerPlayAudioResource,
  audioPlayerStop,
  audioPlayerUnpause,
  entersState,
  guildCommandsPermissionsSet,
  interactionDeferReply,
  interactionDeleteReply,
  interactionEditReply,
  interactionFollowUp,
  interactionReply,
  interactionUpdate,
  messageDelete,
  messageEdit,
  messageStartThread,
  restPutApplicationGuildCommands,
  roleRemove,
  sendMessage,
  sendPrettyMessage,
  threadsCreate,
  threadDelete,
  voiceConnectionDestroy,
  voiceConnectionJoin,
  voiceConnectionSubscribe,

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

export const isMissingPermissionsError = isDiscordAPIError('Missing Permissions')
export const isUnknownMessageError = isDiscordAPIError('Unknown Message')

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
          isUnknownMessageError(e) ? Future.right<Maybe<Message>>(Maybe.none) : Future.left(e),
        ),
        futureMaybe.matchE(() => fetchMessageRec(message)(tail), flow(Maybe.some, Future.right)),
      )
    }
    return Future.right(Maybe.none)
  }
