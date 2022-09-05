import type { APIMessage, Message, PartialMessage } from 'discord.js'
import * as C from 'io-ts/Codec'
import type { Newtype } from 'newtype-ts'
import { iso } from 'newtype-ts'

import { fromNewtype } from '../../shared/utils/ioTsUtils'

export type MessageId = Newtype<{ readonly MessageId: unique symbol }, string>

const { wrap, unwrap } = iso<MessageId>()

const fromMessage = (message: APIMessage | Message | PartialMessage): MessageId => wrap(message.id)

const codec = fromNewtype<MessageId>(C.string)

export const MessageId = { fromMessage, unwrap, codec }
