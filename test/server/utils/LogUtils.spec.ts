import type { Guild, TextChannel, User } from 'discord.js'
import { refinement } from 'fp-ts'

import type { ChannelUtils } from '../../../src/server/utils/ChannelUtils'
import { LogUtils } from '../../../src/server/utils/LogUtils'

const { __testableFormat } = LogUtils
const format = __testableFormat(refinement.id() as typeof ChannelUtils.isNamedChannel)

describe('LogUtils.format', () => {
  it('should format', () => {
    const guild = { name: 'My Guild' } as Guild
    const channel = { name: 'my-channel' } as TextChannel
    const author = { tag: 'User#12345' } as User

    expect(format(null, null, null)).toStrictEqual('')
    expect(format(guild, null, null)).toStrictEqual('[My Guild]')
    expect(format(null, null, channel)).toStrictEqual('#my-channel')
    expect(format(null, author, null)).toStrictEqual('User#12345:')
    expect(format(guild, null, channel)).toStrictEqual('[My Guild#my-channel]')
    expect(format(guild, author, null)).toStrictEqual('[My Guild] User#12345:')
    expect(format(null, author, channel)).toStrictEqual('#my-channel User#12345:')
    expect(format(guild, author, channel)).toStrictEqual('[My Guild#my-channel] User#12345:')
  })
})
