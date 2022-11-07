import { string } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { ObserverWithRefinement } from '../../shared/models/rx/ObserverWithRefinement'
import { StringUtils } from '../../shared/utils/StringUtils'
import { Future, List, Maybe, NonEmptyArray } from '../../shared/utils/fp'

import type { DiscordConnector } from '../helpers/DiscordConnector'
import { MadEvent } from '../models/event/MadEvent'

type UwURenamerObserver = ReturnType<typeof of>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const of = (discord: DiscordConnector) => {
  console.log('discord =', discord)
  const res = discord.client.guilds.valueOf().toJSON()[0]?.members

  return ObserverWithRefinement.fromNext(MadEvent, 'GuildMemberAdd')(event => Future.todo())
}

type IGuildMember = {
  readonly id: string
  readonly user: {
    readonly username: string
  }
  readonly nickname: string | null
}

const uwuOrOwORegex = /(uwu|owo)/i

const isValidUwU = (nickname: string): boolean =>
  uwuOrOwORegex.test(StringUtils.cleanUTF8ToASCII(nickname))

// none: no rename needed
const renameUwU = (username: string): Maybe<string> => {
  if (isValidUwU(username)) return Maybe.none
  const reversed = StringUtils.reverse(username)
  return pipe(
    renamersReversed,
    List.findFirstMap(rename => pipe(rename(reversed), Maybe.fromPredicate(isValidUwU))),
    Maybe.map(StringUtils.reverse),
    Maybe.getOrElse(() =>
      pipe(renamersNormal, NonEmptyArray.unappend, ([initRenamers, lastRenamer]) =>
        pipe(
          initRenamers,
          List.findFirstMap(rename => pipe(rename(username), Maybe.fromPredicate(isValidUwU))),
          Maybe.getOrElse(() => lastRenamer(username)),
        ),
      ),
    ),
    Maybe.some,
  )
}

const spaceRegex = /\s/

const renamersReversed: NonEmptyArray<(username: string) => string> = [
  string.replace('U', 'UwU'),
  string.replace('u', 'UwU'),
  string.replace('O', 'OwO'),
  string.replace('Y', 'UwU'),
  string.replace('y', 'UwUy'), // y close enough to u; UwUy becomes yUwU after reverse
  string.replace('o', 'OwO'),
  string.replace('w', 'UwU'),
  string.replace('0', 'OwO'),
]

const renamersNormal: NonEmptyArray<(username: string) => string> = [
  // if nothing interesting in username, just append it
  string.replace(/[aeiouy]$/i, 'UwU'), // squish ending vowel
  s => (spaceRegex.test(s) ? `${s} UwU` : `${s}UwU`),
]

const UwURenamerObserver = { of, isValidUwU, renameUwU }

export { UwURenamerObserver }
