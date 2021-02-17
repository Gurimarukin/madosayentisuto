import * as C from 'io-ts/Codec'
import { Lens as MonocleLens } from 'monocle-ts'

import { Maybe } from '../../utils/fp'
import { GuildId } from '../GuildId'
import { TSnowflake } from '../TSnowflake'
import { StaticCalls } from './StaticCalls'

export type GuildState = C.TypeOf<typeof GuildState.codec>

export function GuildState(
  id: GuildId,
  calls: Maybe<StaticCalls>,
  defaultRole: Maybe<TSnowflake>,
): GuildState {
  return { id, calls, defaultRole }
}

export namespace GuildState {
  export const codec = C.type({
    id: GuildId.codec,
    calls: Maybe.codec(StaticCalls.codec),
    defaultRole: Maybe.codec(TSnowflake.codec),
  })

  export type Output = C.OutputOf<typeof codec>

  export const empty = (id: GuildId): GuildState => GuildState(id, Maybe.none, Maybe.none)

  export namespace Lens {
    export const calls = MonocleLens.fromPath<GuildState>()(['calls'])
    export const defaultRole = MonocleLens.fromPath<GuildState>()(['defaultRole'])
  }
}
