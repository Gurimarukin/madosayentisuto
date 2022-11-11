import type { APIMessage, Message, PartialMessage } from 'discord.js'
import { eq, string } from 'fp-ts'
import { pipe } from 'fp-ts/function'
import * as C from 'io-ts/Codec'
import type { Newtype } from 'newtype-ts'
import { iso } from 'newtype-ts'

import { fromNewtype } from '../utils/ioTsUtils'

export type MessageId = Newtype<{ readonly MessageId: unique symbol }, string>

const { wrap, unwrap } = iso<MessageId>()

const fromMessage = (message: APIMessage | Message | PartialMessage): MessageId => wrap(message.id)

const codec = fromNewtype<MessageId>(C.string)

const Eq: eq.Eq<MessageId> = pipe(string.Eq, eq.contramap(unwrap))

export const MessageId = { fromMessage, unwrap, codec, Eq }
