import * as Obs from 'fp-ts-rxjs/lib/ObservableEither'
import {
  ActivityOptions,
  Channel,
  Client,
  DiscordAPIError,
  EmojiIdentifierResolvable,
  Guild,
  GuildChannel,
  GuildMember,
  Invite,
  InviteOptions,
  Message,
  MessageAdditions,
  MessageEmbed,
  MessageOptions,
  MessageReaction,
  PartialGuildMember,
  PartialTextBasedChannelFields,
  Presence,
  Role,
  RoleResolvable,
  StringResolvable,
  User
} from 'discord.js'
import { fromEventPattern } from 'rxjs'

import { ObservableE } from '../models/ObservableE'
import { TSnowflake } from '../models/TSnowflake'
import { VoiceStateUpdate } from '../models/VoiceStateUpdate'
import { Maybe, pipe, Future, Task, Either, flow } from '../utils/fp'
import { GuildMemberEvent } from '../models/GuildMemberEvent'
import { Colors } from '../utils/Colors'

export type DiscordConnector = ReturnType<typeof DiscordConnector>

export const DiscordConnector = (client: Client) => {
  return {
    isSelf: (user: User): boolean =>
      pipe(
        Maybe.fromNullable(client.user),
        Maybe.exists(_ => _.id === user.id)
      ),

    /**
     * Observables
     */
    messages: (): ObservableE<Message> =>
      pipe(
        fromEventPattern<Message>(handler => client.on('message', handler)),
        Obs.rightObservable
      ),

    voiceStateUpdates: (): ObservableE<VoiceStateUpdate> =>
      pipe(
        fromEventPattern<VoiceStateUpdate>(handler =>
          client.on('voiceStateUpdate', (oldState, newState) =>
            handler(VoiceStateUpdate(oldState, newState))
          )
        ),
        Obs.rightObservable
      ),

    guildMemberEvents: (): ObservableE<GuildMemberEvent> =>
      pipe(
        fromEventPattern<GuildMemberEvent>(handler => {
          client.on('guildMemberAdd', member =>
            pipe(
              fullMember(member),
              Future.map(_ => handler(GuildMemberEvent.Add(_))),
              Future.runUnsafe
            )
          )
          client.on('guildMemberRemove', member =>
            pipe(
              fullMember(member),
              Future.map(_ => handler(GuildMemberEvent.Remove(_))),
              Future.runUnsafe
            )
          )
        }),
        Obs.rightObservable
      ),

    /**
     * Read
     */
    fetchChannel: (channel: TSnowflake): Future<Maybe<Channel>> =>
      pipe(
        Future.apply(() => client.channels.fetch(TSnowflake.unwrap(channel))),
        Task.map(flow(Maybe.fromEither, Either.right))
      ),

    fetchUser: (user: TSnowflake): Future<Maybe<User>> =>
      pipe(
        Future.apply(() => client.users.fetch(TSnowflake.unwrap(user))),
        Task.map(flow(Maybe.fromEither, Either.right))
      ),

    fetchRole: (guild: Guild, role: TSnowflake): Future<Maybe<Role>> =>
      pipe(
        Future.apply(() => guild.roles.fetch(TSnowflake.unwrap(role))),
        Future.map(Maybe.fromNullable)
      ),

    /**
     * Write
     */
    setActivity: (name: string, options?: ActivityOptions): Future<Maybe<Presence>> =>
      pipe(
        Maybe.fromNullable(client.user),
        Maybe.fold(
          () => Future.right(Maybe.none),
          _ =>
            pipe(
              Future.apply(() => _.setActivity(name, options)),
              Future.map(Maybe.fromNullable)
            )
        )
      ),

    sendMessage,

    sendPrettyMessage: (
      channel: PartialTextBasedChannelFields,
      content: string,
      options?: MessageOptions | (MessageOptions & { split?: false }) | MessageAdditions
    ): Future<Maybe<Message>> =>
      sendMessage(
        channel,
        new MessageEmbed().setColor(Colors.darkred).setDescription(content),
        options
      ),

    reactMessage: (message: Message, emoji: EmojiIdentifierResolvable): Future<MessageReaction> =>
      Future.apply(() => message.react(emoji)),

    addRole: (
      member: GuildMember,
      roleOrRoles: RoleResolvable | RoleResolvable[],
      reason?: string
    ): Future<Maybe<void>> =>
      pipe(
        Future.apply(() => member.roles.add(roleOrRoles, reason)),
        Future.map(_ => {}),
        Task.map(flow(Maybe.fromEither, Either.right))
      ),

    createInvite: (channel: GuildChannel, options?: InviteOptions): Future<Invite> =>
      Future.apply(() => channel.createInvite(options)),

    deleteMessage: (message: Message): Future<boolean> =>
      pipe(
        Future.apply(() => message.delete()),
        Future.map(_ => true),
        Future.recover<boolean>([
          e => e instanceof DiscordAPIError && e.message === 'Missing Permissions',
          false
        ])
      )
  }

  function sendMessage(
    channel: PartialTextBasedChannelFields,
    content: StringResolvable,
    options?: MessageOptions | (MessageOptions & { split?: false }) | MessageAdditions
  ): Future<Maybe<Message>> {
    return pipe(
      Future.apply(() => channel.send(content, options)),
      Future.map(Maybe.some),
      Future.recover<Maybe<Message>>([
        e => e instanceof DiscordAPIError && e.message === 'Cannot send messages to this user',
        Maybe.none
      ])
    )
  }

  function fullMember(member: GuildMember | PartialGuildMember): Future<GuildMember> {
    return member.partial ? Future.apply(() => member.fetch()) : Future.right(member)
  }
}
