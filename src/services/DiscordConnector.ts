import * as Obs from 'fp-ts-rxjs/lib/ObservableEither'
import {
  Client,
  Message,
  PartialTextBasedChannelFields,
  StringResolvable,
  MessageOptions,
  MessageAdditions,
  ClientUser
} from 'discord.js'
import { fromEventPattern } from 'rxjs'

import { ObservableE } from '../models/ObservableE'
import { Maybe, pipe, Future } from '../utils/fp'

export type DiscordConnector = ReturnType<typeof DiscordConnector>

export const DiscordConnector = (client: Client) => {
  const self = (): Maybe<ClientUser> => Maybe.fromNullable(client.user)

  const messages: ObservableE<Message> = pipe(
    fromEventPattern<Message>(handler => client.on('message', handler)),
    Obs.rightObservable
  )

  const sendMessage = (
    channel: PartialTextBasedChannelFields,
    content: StringResolvable,
    options?: MessageOptions | (MessageOptions & { split?: false }) | MessageAdditions
  ): Future<Message> => Future.apply(() => channel.send(content, options))

  return { self, messages, sendMessage }
}
