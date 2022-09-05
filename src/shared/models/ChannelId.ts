import type { APIPartialChannel } from 'discord.js'
import * as C from 'io-ts/Codec'
import type { Newtype } from 'newtype-ts'
import { iso } from 'newtype-ts'

import { fromNewtype } from '../utils/ioTsUtils'

export type ChannelId = Newtype<{ readonly ChannelId: unique symbol }, string>

const { wrap, unwrap } = iso<ChannelId>()

const fromChannel = (channel: APIPartialChannel): ChannelId => wrap(channel.id)

const codec = fromNewtype<ChannelId>(C.string)

export const ChannelId = { fromChannel, unwrap, codec }
