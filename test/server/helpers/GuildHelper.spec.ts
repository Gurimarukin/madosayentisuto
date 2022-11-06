import type { Guild } from 'discord.js'

import { Maybe } from '../../../src/shared/utils/fp'

import { GuildHelper } from '../../../src/server/helpers/GuildHelper'

describe('GuildHelper.getEmoji', () => {
  it('should get emoji', () => {
    const billyEmoji = { id: '986925500595327036', name: 'Billy' }

    const getEmoji = GuildHelper.getEmoji({
      emojis: { valueOf: () => ({ toJSON: () => [billyEmoji] }) },
    } as unknown as Guild)

    expect(getEmoji('<:billy:986925500595327036>')).toStrictEqual(Maybe.some(billyEmoji))
    expect(getEmoji('<a:billy:986925500595327036>')).toStrictEqual(Maybe.some(billyEmoji))
    expect(getEmoji('<emoji:986925500595327036>')).toStrictEqual(Maybe.some(billyEmoji))
    expect(getEmoji(':billy:')).toStrictEqual(Maybe.some(billyEmoji))
    expect(getEmoji('986925500595327036')).toStrictEqual(Maybe.some(billyEmoji))
    expect(getEmoji('billy')).toStrictEqual(Maybe.some(billyEmoji))
    expect(getEmoji('biLLy')).toStrictEqual(Maybe.some(billyEmoji))

    expect(getEmoji('<billy>')).toStrictEqual(Maybe.none)
    expect(getEmoji('bily')).toStrictEqual(Maybe.none)
  })
})
