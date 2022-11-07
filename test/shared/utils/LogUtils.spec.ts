import type { Guild, TextChannel, User } from 'discord.js'
import { refinement } from 'fp-ts'

import type { ChannelUtils } from '../../../src/server/utils/ChannelUtils'
import { LogUtils } from '../../../src/server/utils/LogUtils'

import { expectT } from '../../expectT'

const { __testableFormat } = LogUtils
const format = __testableFormat(refinement.id() as typeof ChannelUtils.isNamed)

describe('LogUtils.format', () => {
  it('should format', () => {
    const guild = { name: 'My Guild' } as Guild
    const channel = { name: 'my-channel' } as TextChannel
    const author = { tag: 'User#12345' } as User

    expectT(format(null, null, null)).toStrictEqual('')
    expectT(format(guild, null, null)).toStrictEqual('[My Guild]')
    expectT(format(null, null, channel)).toStrictEqual('#my-channel')
    expectT(format(null, author, null)).toStrictEqual('User#12345:')
    expectT(format(guild, null, channel)).toStrictEqual('[My Guild#my-channel]')
    expectT(format(guild, author, null)).toStrictEqual('[My Guild] User#12345:')
    expectT(format(null, author, channel)).toStrictEqual('#my-channel User#12345:')
    expectT(format(guild, author, channel)).toStrictEqual('[My Guild#my-channel] User#12345:')
  })
})
