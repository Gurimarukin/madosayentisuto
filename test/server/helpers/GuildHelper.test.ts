/* eslint-disable functional/no-expression-statements */
import { pipe } from 'fp-ts/function'
import { describe, expect, it } from 'vitest'

import { GuildId } from '../../../src/shared/models/guild/GuildId'
import type { Dict, Tuple } from '../../../src/shared/utils/fp'
import { Future, Maybe } from '../../../src/shared/utils/fp'

import { Config } from '../../../src/server/config/Config'
import { constants } from '../../../src/server/config/constants'
import { DiscordConnector } from '../../../src/server/helpers/DiscordConnector'
import { GuildHelper } from '../../../src/server/helpers/GuildHelper'
import type { ChampionLevel_ } from '../../../src/server/models/theQuest/ChampionLevel'

import { expectT } from '../../expectT'

describe('GuildHelper.getEmoji', async () => {
  const guild = await pipe(
    Future.fromIOEither(Config.load),
    Future.chain(config => DiscordConnector.fromConfig(config.client)),
    Future.chainIOEitherK(discord => discord.getGuild(GuildId.wrap('703903640594939946'))),
    Future.runUnsafe,
  )

  expect.assert(Maybe.isSome(guild))

  await guild.value.emojis.fetch()
  await guild.value.client.application.emojis.fetch()

  const getEmoji = GuildHelper.getEmoji(guild.value)

  it.each([
    ['<:billy:986925500595327036>', '986925500595327036'],
    ['<a:billy:986925500595327036>', '986925500595327036'],
    ['<emoji:986925500595327036>', '986925500595327036'],
    [':billy:', '986925500595327036'],
    ['986925500595327036', '986925500595327036'],
    ['billy', '986925500595327036'],
    ['biLLy', '986925500595327036'],
    ...Object.values({
      5: [constants.emojis.masteries[5], '1459004032252248276'],
      6: [constants.emojis.masteries[6], '1459004033363611792'],
      7: [constants.emojis.masteries[7], '1459004035150647327'],
      8: [constants.emojis.masteries[8], '1459004036601741353'],
      9: [constants.emojis.masteries[9], '1459004037923078316'],
      10: [constants.emojis.masteries[10], '1459004039147819262'],
    } satisfies Dict<`${ChampionLevel_}`, Tuple<string, string>>),
  ])('%s should resolve as %s', (emoji, expected) => {
    const actual = getEmoji(emoji)

    expect.assert(Maybe.isSome(actual))

    expectT(actual.value.id).toStrictEqual(expected)
  })
})
