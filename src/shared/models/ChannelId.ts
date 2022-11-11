import type { APIPartialChannel } from 'discord.js'
import { eq, string } from 'fp-ts'
import { pipe } from 'fp-ts/function'
import * as C from 'io-ts/Codec'
import type { Newtype } from 'newtype-ts'
import { iso } from 'newtype-ts'

import { fromNewtype } from '../utils/ioTsUtils'

export type ChannelId = Newtype<{ readonly ChannelId: unique symbol }, string>

const { wrap, unwrap } = iso<ChannelId>()

const fromChannel = (channel: APIPartialChannel): ChannelId => wrap(channel.id)

const codec = fromNewtype<ChannelId>(C.string)

const Eq: eq.Eq<ChannelId> = pipe(string.Eq, eq.contramap(unwrap))

export const ChannelId = { fromChannel, unwrap, codec, Eq }
