import { VoiceConnection, Message } from 'discord.js'
import { Lens as MonocleLens } from 'monocle-ts'

import { TrackMetadata } from './TrackMetadata'
import { Maybe, Dict } from '../utils/fp'

export type PlayerState = Dict<PlayerGuildState>

interface PlayerPreload {
  readonly message: Maybe<Message>
  readonly locked: boolean
  readonly queue: TrackMetadata[]
}

function PlayerPreload(
  message: Maybe<Message>,
  locked: boolean,
  queue: TrackMetadata[]
): PlayerPreload {
  return { message, locked, queue }
}

namespace PlayerPreload {
  export const empty: PlayerPreload = PlayerPreload(Maybe.none, false, [])
}

export interface PlayerGuildState {
  readonly connection: Maybe<VoiceConnection>
  readonly playing: Maybe<TrackMetadata>
  readonly queue: TrackMetadata[]
  readonly preload: PlayerPreload
}

export function PlayerGuildState(
  connection: Maybe<VoiceConnection>,
  playing: Maybe<TrackMetadata>,
  queue: TrackMetadata[],
  preload: PlayerPreload
): PlayerGuildState {
  return { connection, playing, queue, preload }
}

export namespace PlayerGuildState {
  export const empty: PlayerGuildState = PlayerGuildState(
    Maybe.none,
    Maybe.none,
    [],
    PlayerPreload.empty
  )

  export namespace Lens {
    export const connection = MonocleLens.fromPath<PlayerGuildState>()(['connection'])
    export const preloadLocked = MonocleLens.fromPath<PlayerGuildState>()(['preload', 'locked'])
    export const preloadMessage = MonocleLens.fromPath<PlayerGuildState>()(['preload', 'message'])
  }
}
