import * as Obs from 'fp-ts-rxjs/lib/ObservableEither'
import {
  Client,
  Message,
  PartialTextBasedChannelFields,
  StringResolvable,
  MessageOptions,
  MessageAdditions
} from 'discord.js'
import { fromEventPattern } from 'rxjs'

import { ObservableE } from '../models/ObservableE'
import { Maybe, pipe, Future } from '../utils/fp'

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

  const sendMessage = (
    channel: PartialTextBasedChannelFields,
    content: StringResolvable,
    options?: MessageOptions | (MessageOptions & { split?: false }) | MessageAdditions
  ): Future<Message> => Future.apply(() => channel.send(content, options))

  return { isFromSelf, messages, sendMessage }
}
