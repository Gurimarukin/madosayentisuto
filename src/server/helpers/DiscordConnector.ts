import type {
  AudioPlayer,
  AudioPlayerStatus,
  AudioResource,
  DiscordGatewayAdapterCreator,
  PlayerSubscription,
  VoiceConnection,
  VoiceConnectionStatus,
} from '@discordjs/voice'
import {
  createAudioPlayer,
  entersState as discordEntersState,
  joinVoiceChannel,
} from '@discordjs/voice'
import type {
  APIApplicationCommandPermission,
  APIMessage,
  ApplicationCommand,
  ButtonInteraction,
  Channel,
  ClientPresence,
  Collection,
  CommandInteraction,
  EmojiIdentifierResolvable,
  Guild,
  GuildAuditLogsEntry,
  GuildAuditLogsFetchOptions,
  GuildAuditLogsResolvable,
  GuildMember,
  InteractionDeferReplyOptions,
  InteractionReplyOptions,
  InteractionUpdateOptions,
  Message,
  MessageComponentInteraction,
  MessageCreateOptions,
  MessageEditOptions,
  MessagePayload,
  MessageReaction,
  ModalSubmitInteraction,
  PartialTextBasedChannelFields,
  REST,
  RESTPostAPIApplicationCommandsJSONBody,
  RequestData,
  Role,
  RoleResolvable,
  StartThreadOptions,
  ThreadChannel,
  User,
  VoiceState,
} from 'discord.js'
import { Client, DiscordAPIError, GatewayIntentBits, Partials, Routes } from 'discord.js'
import { refinement } from 'fp-ts'
import { pipe } from 'fp-ts/function'
import type { Decoder } from 'io-ts/Decoder'
import * as D from 'io-ts/Decoder'

import { ChannelId } from '../../shared/models/ChannelId'
import { DiscordUserId } from '../../shared/models/DiscordUserId'
import { MessageId } from '../../shared/models/MessageId'
import { MsDuration } from '../../shared/models/MsDuration'
import { GuildId } from '../../shared/models/guild/GuildId'
import type { NotUsed, Tuple } from '../../shared/utils/fp'
import { Either, Future, IO, List, Maybe, NonEmptyArray, toNotUsed } from '../../shared/utils/fp'
import { futureMaybe } from '../../shared/utils/futureMaybe'
import { decodeError } from '../../shared/utils/ioTsUtils'

import type { ClientConfig } from '../config/Config'
import { constants } from '../config/constants'
import { RoleId } from '../models/RoleId'
import type { Activity } from '../models/botState/Activity'
import { ActivityTypeBot } from '../models/botState/ActivityTypeBot'
import { CommandId } from '../models/command/CommandId'
import { GlobalPutCommandResult } from '../models/command/putCommandResult/GlobalPutCommandResult'
import { GuildPutCommandResult } from '../models/command/putCommandResult/GuildPutCommandResult'
import { BotToken } from '../models/discord/BotToken'
import { MessageComponent } from '../models/discord/MessageComponent'
import type { Modal } from '../models/discord/Modal'
import type { GuildAudioChannel, GuildSendableChannel } from '../utils/ChannelUtils'
import { ChannelUtils } from '../utils/ChannelUtils'
import { debugLeft } from '../utils/debugLeft'

type MyPartial<A> = {
  readonly partial: boolean
  readonly fetch: () => Promise<A>
}

export type MyInteraction =
  | CommandInteraction
  | MessageComponentInteraction
  | ModalSubmitInteraction

export type DiscordConnector = ReturnType<typeof of>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const of = (client: Client<true>) => {
  const listGuilds: IO<List<Guild>> = IO.tryCatch(() => client.guilds.cache.toJSON())

  return {
    client,

    /**
     * Read
     */

    fetchChannel: (channelId: ChannelId): Future<Maybe<Channel>> =>
      pipe(
        Future.tryCatch(() => client.channels.fetch(ChannelId.unwrap(channelId))),
        Future.map(Maybe.fromNullable),
        Future.orElse(e => (isUnknownChannelError(e) ? futureMaybe.none : Future.left(e))),
        debugLeft('fetchChannel'),
      ),

    fetchUser: (userId: DiscordUserId): Future<Maybe<User>> =>
      pipe(
        IO.tryCatch(() => client.users.cache.get(DiscordUserId.unwrap(userId))),
        IO.map(Maybe.fromNullable),
        Future.fromIOEither,
        futureMaybe.alt(() =>
          pipe(
            Future.tryCatch(() => client.users.fetch(DiscordUserId.unwrap(userId))),
            Future.map(Maybe.some),
          ),
        ),
        debugLeft('fetchUser'),
      ),

    getGuild: (guildId: GuildId): IO<Maybe<Guild>> =>
      IO.tryCatch(() => Maybe.fromNullable(client.guilds.cache.get(GuildId.unwrap(guildId)))),

    listGuilds,

    /**
     * Write
     */

    setActivity: (activity: Maybe<Activity>): IO<ClientPresence> =>
      IO.tryCatch(() =>
        pipe(
          activity,
          Maybe.fold(
            () => client.user.setActivity(),
            ({ name, type }) =>
              client.user.setActivity(name, { type: ActivityTypeBot.activityType[type] }),
          ),
        ),
      ),
  }
}

/**
 * Read
 */

const fetchAuditLogs = <A extends GuildAuditLogsResolvable = null>(
  guild: Guild,
  options?: GuildAuditLogsFetchOptions<A>,
): Future<Maybe<Collection<string, GuildAuditLogsEntry<A>>>> =>
  pipe(
    Future.tryCatch(() => guild.fetchAuditLogs<A>(options)),
    Future.map(logs => Maybe.some(logs.entries)),
    Future.orElse(e => (isMissingPermissionsError(e) ? futureMaybe.none : Future.left(e))),
    debugLeft('fetchAuditLogs'),
  )

const fetchCommand = (guild: Guild, commandId: CommandId): Future<ApplicationCommand> =>
  Future.tryCatch(() => guild.commands.fetch(CommandId.unwrap(commandId)))

const fetchMember = (guild: Guild, userId: DiscordUserId): Future<Maybe<GuildMember>> =>
  pipe(
    Future.tryCatch(() => guild.members.fetch(DiscordUserId.unwrap(userId))),
    Future.map(Maybe.some),
    debugLeft('fetchMember'),
  )

const fetchMembers = (guild: Guild): Future<Collection<string, GuildMember>> =>
  pipe(
    Future.tryCatch(() => guild.members.fetch()),
    debugLeft('fetchMembers'),
  )

const fetchMessage = (guild: Guild, messageId: MessageId): Future<Maybe<Message<true>>> =>
  pipe(
    IO.tryCatch(() => guild.channels.cache.toJSON()),
    IO.map(List.filter(ChannelUtils.isGuildSendable)),
    Future.fromIOEither,
    Future.chain(fetchMessageRec(MessageId.unwrap(messageId))),
    debugLeft('fetchMessage'),
  )

const fetchPartial = <A extends MyPartial<A>>(partial: A): Future<A> =>
  partial.partial
    ? pipe(
        Future.tryCatch(() => partial.fetch()),
        debugLeft('fetchPartial'),
      )
    : Future.right(partial)

const fetchRole = (guild: Guild, roleId: RoleId): Future<Maybe<Role>> =>
  pipe(
    Future.tryCatch(() => guild.roles.fetch(RoleId.unwrap(roleId))),
    Future.map(Maybe.fromNullable),
    debugLeft('fetchRole'),
  )

const hasRole = (member: GuildMember, role: Role): boolean => member.roles.cache.has(role.id)

/**
 * Write
 */

const audioPlayerCreate: IO<AudioPlayer> = IO.tryCatch(() => createAudioPlayer())

const audioPlayerPause = (audioPlayer: AudioPlayer): IO<boolean> =>
  IO.tryCatch(() => audioPlayer.pause())

const audioPlayerPlayAudioResource = (
  audioPlayer: AudioPlayer,
  audioResource: AudioResource,
): IO<NotUsed> =>
  pipe(
    IO.tryCatch(() => audioPlayer.play(audioResource)),
    IO.map(toNotUsed),
  )

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

const interactionDeferReply = (
  interaction: MyInteraction,
  options?: InteractionDeferReplyOptions,
): Future<NotUsed> =>
  pipe(
    Future.tryCatch(() => interaction.deferReply(options)),
    Future.map(toNotUsed), // TODO: maybe do something with result?
    debugLeft('interactionDeferReply'),
  )

const interactionDeleteReply = (interaction: MyInteraction): Future<NotUsed> =>
  pipe(
    Future.tryCatch(() => interaction.deleteReply()),
    Future.map(toNotUsed),
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

// Call this function if you used interactionDeferReply...
const interactionFollowUp = (
  interaction: MyInteraction,
  options: string | MessagePayload | InteractionReplyOptions,
): Future<APIMessage | Message> =>
  pipe(
    Future.tryCatch(() => interaction.followUp(options)),
    debugLeft('interactionFollowUp'),
  )

// ...or call this one if you didn't call interactionDeferReply.
const interactionReply = (
  interaction: MyInteraction,
  options: string | MessagePayload | InteractionReplyOptions,
): Future<NotUsed> =>
  pipe(
    Future.tryCatch(() => interaction.reply(options)),
    Future.map(toNotUsed), // TODO: maybe do something with result?
    Future.orElse(e =>
      isDiscordAPIError('Cannot send an empty message')(e) ? Future.notUsed : Future.left(e),
    ),
    debugLeft('interactionReply'),
  )

const interactionShowModal = (interaction: CommandInteraction, modal: Modal): Future<NotUsed> =>
  pipe(
    Future.tryCatch(() => interaction.showModal(modal)),
    Future.map(toNotUsed),
    debugLeft('interactionShowModal'),
  )

const interactionUpdate = (
  interaction: ButtonInteraction,
  options: string | MessagePayload | InteractionUpdateOptions = {},
): Future<NotUsed> =>
  pipe(
    Future.tryCatch(() => interaction.update(options)),
    Future.map(toNotUsed), // TODO: maybe do something with result?
    Future.orElse(e =>
      isDiscordAPIError('Unknown interaction')(e) ? Future.notUsed : Future.left(e),
    ),
    debugLeft('interactionUpdate'),
  )

const memberSetNickname = (
  member: GuildMember,
  nickname: Maybe<string>,
  reason?: string,
): Future<GuildMember> =>
  pipe(
    Future.tryCatch(() => member.setNickname(Maybe.toNullable(nickname), reason)),
    debugLeft('memberSetNickname'),
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

const messageEdit = <InGuild extends boolean = boolean>(
  message: Message<InGuild>,
  options: string | MessagePayload | MessageEditOptions,
): Future<Message<InGuild>> =>
  pipe(
    Future.tryCatch(() => message.edit(options)),
    debugLeft('messageEdit'),
  )

type ThreadMessageEditError = 'threadIsArchived'

const threadMessageEdit = (
  message: Message,
  options: string | MessagePayload | MessageEditOptions,
): Future<Either<ThreadMessageEditError, Message>> =>
  pipe(
    Future.tryCatch(() => message.edit(options)),
    Future.map(Either.right),
    Future.orElse(e =>
      isThreadIsArchivedError(e)
        ? Future.right(Either.left<ThreadMessageEditError, Message>('threadIsArchived'))
        : Future.left(e),
    ),
    debugLeft('threadMessageEdit'),
  )

const messageReact = (
  message: Message,
  emoji: EmojiIdentifierResolvable,
): Future<MessageReaction> =>
  pipe(
    Future.tryCatch(() => message.react(emoji)),
    debugLeft('messageReact'),
  )

const messageStartThread = (message: Message, options: StartThreadOptions): Future<ThreadChannel> =>
  pipe(
    Future.tryCatch(() => message.startThread(options)),
    debugLeft('messageStartThread'),
  )

const roleAdd = (
  member: GuildMember,
  roleOrRoles: RoleResolvable | List<RoleResolvable>,
  reason?: string,
): Future<boolean> =>
  pipe(
    Future.tryCatch(() => member.roles.add(roleOrRoles, reason)),
    Future.map(() => true),
    Future.orElse(e =>
      isMissingAccessOrMissingPermissionError(e) ? Future.right(false) : Future.left(e),
    ),
    debugLeft('roleAdd'),
  )

const roleRemove = (
  member: GuildMember,
  roleOrRoles: RoleResolvable | List<RoleResolvable>,
  reason?: string,
): Future<boolean> =>
  pipe(
    Future.tryCatch(() => member.roles.remove(roleOrRoles, reason)),
    Future.map(() => true),
    Future.orElse(e =>
      isMissingAccessOrMissingPermissionError(e) ? Future.right(false) : Future.left(e),
    ),
    debugLeft('roleRemove'),
  )

const restPutApplicationCommands =
  (rest: REST, clientId: DiscordUserId) =>
  (
    body: NonEmptyArray<RESTPostAPIApplicationCommandsJSONBody>,
  ): Future<List<GlobalPutCommandResult>> =>
    pipe(
      restPut(rest)(Routes.applicationCommands(DiscordUserId.unwrap(clientId)), {
        body,
      })([GlobalPutCommandResult.decoder, 'GlobalPutCommandResult']),
      debugLeft('restPutApplicationCommands'),
    )

const restPutApplicationGuildCommands =
  (rest: REST, clientId: DiscordUserId, guildId: GuildId) =>
  (
    body: NonEmptyArray<RESTPostAPIApplicationCommandsJSONBody>,
  ): Future<List<GuildPutCommandResult>> =>
    pipe(
      restPut(rest)(
        Routes.applicationGuildCommands(DiscordUserId.unwrap(clientId), GuildId.unwrap(guildId)),
        { body },
      )([GuildPutCommandResult.decoder, 'GuildPutCommandResult']),
      debugLeft('restPutApplicationGuildCommands'),
    )

type PermissionsJSONBody = {
  readonly permissions: NonEmptyArray<APIApplicationCommandPermission>
}

const restPutApplicationCommandPermissions =
  (rest: REST, clientId: DiscordUserId, guildId: GuildId, commandId: CommandId) =>
  (body: PermissionsJSONBody) =>
    pipe(
      restPut(rest)(
        Routes.applicationCommandPermissions(
          DiscordUserId.unwrap(clientId),
          GuildId.unwrap(guildId),
          CommandId.unwrap(commandId),
        ),
        { body },
      )([D.struct({ adedigado: D.string }), '{ adedigado: string }']),
      debugLeft('restPutApplicationCommandPermissions'),
    )

const sendMessage = <InGuild extends boolean = boolean>(
  channel: PartialTextBasedChannelFields<InGuild>,
  options: string | MessagePayload | MessageCreateOptions,
): Future<Maybe<Message<InGuild>>> =>
  pipe(
    Future.tryCatch(() => channel.send(options)),
    Future.map(Maybe.some),
    Future.orElse(e =>
      // user blocked us
      isDiscordAPIError('Cannot send messages to this user')(e) ? futureMaybe.none : Future.left(e),
    ),
    debugLeft('sendMessage'),
  )

const sendPrettyMessage = <InGuild extends boolean = boolean>(
  channel: PartialTextBasedChannelFields<InGuild>,
  message: string,
  options: Omit<MessageCreateOptions, 'embeds'> = {},
): Future<Maybe<Message<InGuild>>> =>
  sendMessage(channel, {
    ...options,
    embeds: [MessageComponent.safeEmbed({ color: constants.messagesColor, description: message })],
  })

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

const threadSetArchived = (
  thread: ThreadChannel,
  archived: boolean,
  reason?: string,
): Future<ThreadChannel> =>
  pipe(
    Future.tryCatch(() => thread.setArchived(archived, reason)),
    debugLeft('threadSetArchived'),
  )

const voiceConnectionDestroy = (connection: VoiceConnection): IO<NotUsed> =>
  pipe(
    IO.tryCatch(() => connection.destroy()),
    IO.map(toNotUsed),
  )

const voiceConnectionJoin = (channel: GuildAudioChannel): IO<VoiceConnection> =>
  IO.tryCatch(() =>
    joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator as DiscordGatewayAdapterCreator, // TODO: on next upgrade, will this cast still be necessary
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

const voiceStateDisconnect = (voiceState: VoiceState, reason?: string): Future<GuildMember> =>
  pipe(
    Future.tryCatch(() => voiceState.disconnect(reason)),
    debugLeft('voiceStateDisconnect'),
  )

/**
 * constructor
 */

const fromConfig = (config: ClientConfig): Future<DiscordConnector> =>
  Future.tryCatch(
    () =>
      new Promise<DiscordConnector>(resolve => {
        const client = new Client({
          intents: [
            GatewayIntentBits.DirectMessages,
            GatewayIntentBits.GuildBans,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildMessageReactions,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.GuildVoiceStates,
            GatewayIntentBits.Guilds,
            GatewayIntentBits.MessageContent,
          ],
          partials: [
            Partials.User,
            Partials.Channel,
            Partials.GuildMember,
            Partials.Message,
            Partials.Reaction,
          ],
        })
        /* eslint-disable functional/no-expression-statement */
        client.once('ready', () => resolve(of(client)))
        client.login(BotToken.unwrap(config.token))
        /* eslint-enable functional/no-expression-statement */
      }),
  )

export const DiscordConnector = {
  fetchAuditLogs,
  fetchCommand,
  fetchMember,
  fetchMembers,
  fetchMessage,
  fetchPartial,
  fetchRole,
  hasRole,

  audioPlayerCreate,
  audioPlayerPause,
  audioPlayerPlayAudioResource,
  audioPlayerStop,
  audioPlayerUnpause,
  entersState,
  interactionDeferReply,
  interactionDeleteReply,
  interactionEditReply,
  interactionFollowUp,
  interactionReply,
  interactionShowModal,
  interactionUpdate,
  memberSetNickname,
  messageDelete,
  messageEdit,
  messageReact,
  messageStartThread,
  restPutApplicationCommandPermissions,
  restPutApplicationCommands,
  restPutApplicationGuildCommands,
  roleAdd,
  roleRemove,
  sendMessage,
  sendPrettyMessage,
  threadDelete,
  threadMessageEdit,
  threadSetArchived,
  voiceConnectionDestroy,
  voiceConnectionJoin,
  voiceConnectionSubscribe,
  voiceStateDisconnect,

  fromConfig,
}

/**
 * Helpers
 */

const isDiscordAPIError =
  (message: string) =>
  (e: Error): e is DiscordAPIError =>
    e instanceof DiscordAPIError && e.message === message

const isMissingAccessError = isDiscordAPIError('Missing Access')
const isUnknownChannelError = isDiscordAPIError('Unknown Channel')
export const isMissingPermissionsError = isDiscordAPIError('Missing Permissions')
export const isUnknownMessageError = isDiscordAPIError('Unknown Message')
const isThreadIsArchivedError = isDiscordAPIError('Thread is archived')

const isMissingAccessOrMissingPermissionError = pipe(
  isMissingAccessError,
  refinement.or(isMissingPermissionsError),
)
const isMissingAccessOrUnknownMessageError = pipe(
  isMissingAccessError,
  refinement.or(isUnknownMessageError),
)

const fetchMessageRec =
  (message: string) =>
  (channels: List<GuildSendableChannel>): Future<Maybe<Message<true>>> => {
    if (List.isNonEmpty(channels)) {
      const [head, ...tail] = channels
      return pipe(
        Future.tryCatch(() => head.messages.fetch(message)),
        Future.map(Maybe.some),
        Future.orElse(e =>
          isMissingAccessOrUnknownMessageError(e) ? futureMaybe.none : Future.left(e),
        ),
        futureMaybe.matchE(() => fetchMessageRec(message)(tail), futureMaybe.some),
      )
    }
    return futureMaybe.none
  }

const restPut =
  (rest: REST) =>
  (fullRoute: `/${string}`, options?: RequestData | undefined) =>
  <A>([decoder, decoderName]: Tuple<Decoder<unknown, A>, string>): Future<NonEmptyArray<A>> =>
    pipe(
      Future.tryCatch(() => rest.put(fullRoute, options)),
      Future.chainEitherK(u =>
        pipe(
          NonEmptyArray.decoder(decoder).decode(u),
          Either.mapLeft(decodeError(`NonEmptyArray<${decoderName}>`)(u)),
        ),
      ),
    )
