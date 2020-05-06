import * as t from 'io-ts'
import { optionFromNullable } from 'io-ts-types/lib/optionFromNullable'
import { Lens as MonocleLens } from 'monocle-ts'

import { GuildId } from './GuildId'
import { TSnowflake } from './TSnowflake'
import { Maybe } from '../utils/fp'

export type GuildState = t.TypeOf<typeof GuildState.codec>

export function GuildState(id: GuildId, defaultRole: Maybe<TSnowflake>): GuildState {
  return { id, defaultRole }
}

export namespace GuildState {
  export const codec = t.strict({
    id: GuildId.codec,
    defaultRole: optionFromNullable(TSnowflake.codec)
  })

  export const empty = (id: GuildId): GuildState => GuildState(id, Maybe.none)

  export namespace Lens {
    export const defaultRole = MonocleLens.fromPath<GuildState>()(['defaultRole'])
  }
}
