import type { VoiceConnectionState, VoiceConnectionStatus } from '@discordjs/voice'

import { createUnion } from '../../utils/createUnion'

export type MusicEvent = typeof MusicEvent.T

export const MusicEvent = createUnion({
  ConnectionError: (error: Error) => ({ error }),

  PlayerError: (error: Error) => ({ error }),

  VoiceConnectionReady: (
    oldState: VoiceConnectionState,
    newState: VoiceConnectionState & { readonly status: VoiceConnectionStatus.Ready },
  ) => ({ oldState, newState }),
})

export type MusicEventConnectionError = typeof MusicEvent.ConnectionError.T
export type MusicEventPlayerError = typeof MusicEvent.PlayerError.T
export type MusicEventVoiceConnectionReady = typeof MusicEvent.VoiceConnectionReady.T
