import * as t from 'io-ts'
import { optionFromNullable } from 'io-ts-types/lib/optionFromNullable'
import { Lens as MonocleLens } from 'monocle-ts'

import { StaticCalls } from './StaticCalls'
import { GuildId } from '../GuildId'
import { TSnowflake } from '../TSnowflake'
import { Maybe } from '../../utils/fp'

export type GuildState = t.TypeOf<typeof GuildState.codec>

export function GuildState(
  id: GuildId,
  calls: Maybe<StaticCalls>,
  defaultRole: Maybe<TSnowflake>
): GuildState {
  return { id, calls, defaultRole }
}

export namespace GuildState {
  export const codec = t.strict({
    id: GuildId.codec,
    calls: optionFromNullable(StaticCalls.codec),
    defaultRole: optionFromNullable(TSnowflake.codec)
  })

  export const empty = (id: GuildId): GuildState => GuildState(id, Maybe.none, Maybe.none)

  export namespace Lens {
    export const calls = MonocleLens.fromPath<GuildState>()(['calls'])
    export const defaultRole = MonocleLens.fromPath<GuildState>()(['defaultRole'])
  }
}
