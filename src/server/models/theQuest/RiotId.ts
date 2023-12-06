import { pipe } from 'fp-ts/function'
import type { Codec } from 'io-ts/Codec'
import * as C from 'io-ts/Codec'
import type { Decoder } from 'io-ts/Decoder'
import * as D from 'io-ts/Decoder'
import * as E from 'io-ts/Encoder'
import { type Newtype, iso } from 'newtype-ts'

import { StringUtils } from '../../../shared/utils/StringUtils'
import { Maybe } from '../../../shared/utils/fp'

type GameName = Newtype<{ readonly GameName: unique symbol }, string>

const gameNameIso = iso<GameName>()

type TagLine = Newtype<{ readonly TagLine: unique symbol }, string>

const tagLineIso = iso<TagLine>()

type RiotId = {
  gameName: GameName
  tagLine: TagLine
}

const regex = /^(.+)#([^#]+)$/

const fromStringDecoder: Decoder<unknown, RiotId> = pipe(
  D.string,
  D.parse(str =>
    pipe(
      str,
      StringUtils.matcher2(regex),
      Maybe.fold(
        () => D.failure(str, 'RiotId'),
        ([gameName, tagLine]) =>
          D.success({
            gameName: gameNameIso.wrap(gameName),
            tagLine: tagLineIso.wrap(tagLine),
          }),
      ),
    ),
  ),
)

const stringify =
  (sep: string) =>
  ({ gameName, tagLine }: RiotId): string =>
    `${gameNameIso.unwrap(gameName)}${sep}${tagLineIso.unwrap(tagLine)}`

const fromStringCodec: Codec<unknown, string, RiotId> = C.make(
  fromStringDecoder,
  pipe(E.id<string>(), E.contramap(stringify('#'))),
)

const RiotId = { fromStringCodec, stringify }

export { RiotId }
