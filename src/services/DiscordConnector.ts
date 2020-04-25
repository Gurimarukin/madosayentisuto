import * as Obs from 'fp-ts-rxjs/lib/ObservableEither'
import {
  Client,
  Message,
  PartialTextBasedChannelFields,
  StringResolvable,
  MessageOptions,
  MessageAdditions,
  Channel,
  User,
  DiscordAPIError
} from 'discord.js'
import { fromEventPattern } from 'rxjs'

import { ObservableE } from '../models/ObservableE'
import { TSnowflake } from '../models/TSnowflake'
import { VoiceStateUpdate } from '../models/VoiceStateUpdate'
import { Maybe, pipe, Future, Task, Either } from '../utils/fp'

export type DiscordConnector = ReturnType<typeof DiscordConnector>

export const DiscordConnector = (client: Client) => {
  const isFromSelf = (message: Message): boolean =>
    pipe(
      Maybe.fromNullable(client.user),
      Maybe.exists(_ => _.id === message.author.id)
    )

  const messages: ObservableE<Message> = pipe(
    fromEventPattern<Message>(handler => client.on('message', handler)),
    Obs.rightObservable
  )

  const voiceStateUpdates: ObservableE<VoiceStateUpdate> = pipe(
    fromEventPattern<VoiceStateUpdate>(handler =>
      client.on('voiceStateUpdate', (oldState, newState) =>
        handler(VoiceStateUpdate(oldState, newState))
      )
    ),
    Obs.rightObservable
  )

  const sendMessage = (
    channel: PartialTextBasedChannelFields,
    content: StringResolvable,
    options?: MessageOptions | (MessageOptions & { split?: false }) | MessageAdditions
  ): Future<Message> => Future.apply(() => channel.send(content, options))

  const fetchChannel = (channel: TSnowflake): Future<Maybe<Channel>> =>
    pipe(
      Future.apply(() => client.channels.fetch(TSnowflake.unwrap(channel))),
      Task.map(_ => pipe(_, Maybe.fromEither, Either.right))
    )

  const fetchUser = (user: TSnowflake): Future<Maybe<User>> =>
    pipe(
      Future.apply(() => client.users.fetch(TSnowflake.unwrap(user))),
      Task.map(_ => pipe(_, Maybe.fromEither, Either.right))
    )

  const deleteMessage = (message: Message): Future<boolean> =>
    pipe(
      Future.apply(() => message.delete()),
      Task.map(
        Either.fold(
          e =>
            e instanceof DiscordAPIError && e.message === 'Missing Permissions'
              ? Either.right(false)
              : Either.left(e),
          _ => Either.right(true)
        )
      )
    )

  return {
    isFromSelf,
    messages,
    voiceStateUpdates,
    sendMessage,
    fetchChannel,
    fetchUser,
    deleteMessage
  }
}
