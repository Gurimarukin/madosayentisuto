import { Guild, TextChannel, User } from 'discord.js'

import { ChannelUtils } from '../../src/utils/ChannelUtils'
import { LogUtils } from '../../src/utils/LogUtils'

const { __testableFormat } = LogUtils
const format = __testableFormat((() => true) as unknown as typeof ChannelUtils.isNamedChannel)

describe('LogUtils.format', () => {
  it('should format', () => {
    const guild = { name: 'My Guild' } as Guild
    const channel = { name: 'my-channel' } as TextChannel
    const author = { tag: 'User#12345' } as User

    expect(format(null, null, null)).toStrictEqual('')
    expect(format(guild, null, null)).toStrictEqual('[My Guild]')
    expect(format(null, channel, null)).toStrictEqual('#my-channel')
    expect(format(null, null, author)).toStrictEqual('User#12345:')
    expect(format(guild, channel, null)).toStrictEqual('[My Guild#my-channel]')
    expect(format(guild, null, author)).toStrictEqual('[My Guild] User#12345:')
    expect(format(null, channel, author)).toStrictEqual('#my-channel User#12345:')
    expect(format(guild, channel, author)).toStrictEqual('[My Guild#my-channel] User#12345:')
  })
})
