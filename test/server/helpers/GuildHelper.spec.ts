import type { Guild, GuildEmoji } from 'discord.js'

import { Maybe } from '../../../src/shared/utils/fp'

import { GuildHelper } from '../../../src/server/helpers/GuildHelper'

import { expectT } from '../../expectT'

describe('GuildHelper.getEmoji', () => {
  it('should get emoji', () => {
    const billyEmoji = { id: '986925500595327036', name: 'Billy' } as GuildEmoji

    const getEmoji = GuildHelper.getEmoji({
      emojis: { valueOf: () => ({ toJSON: () => [billyEmoji] }) },
    } as Guild)

    expectT(getEmoji('<:billy:986925500595327036>')).toStrictEqual(Maybe.some(billyEmoji))
    expectT(getEmoji('<a:billy:986925500595327036>')).toStrictEqual(Maybe.some(billyEmoji))
    expectT(getEmoji('<emoji:986925500595327036>')).toStrictEqual(Maybe.some(billyEmoji))
    expectT(getEmoji(':billy:')).toStrictEqual(Maybe.some(billyEmoji))
    expectT(getEmoji('986925500595327036')).toStrictEqual(Maybe.some(billyEmoji))
    expectT(getEmoji('billy')).toStrictEqual(Maybe.some(billyEmoji))
    expectT(getEmoji('biLLy')).toStrictEqual(Maybe.some(billyEmoji))

    expectT(getEmoji('<billy>')).toStrictEqual(Maybe.none)
    expectT(getEmoji('bily')).toStrictEqual(Maybe.none)
  })
})
