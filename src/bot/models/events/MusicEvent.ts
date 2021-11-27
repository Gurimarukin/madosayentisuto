import type { VoiceConnectionState, VoiceConnectionStatus } from '@discordjs/voice'

import { createUnion } from '../../utils/createUnion'

export type MusicEvent = typeof MusicEvent.T

export const MusicEvent = createUnion({
  ConnectionError: (error: Error) => ({ error }),

  ConnectionSignalling: (
    oldState: VoiceConnectionState,
    newState: VoiceConnectionState & { readonly status: VoiceConnectionStatus.Signalling },
  ) => ({ oldState, newState }),
  ConnectionConnecting: (
    oldState: VoiceConnectionState,
    newState: VoiceConnectionState & { readonly status: VoiceConnectionStatus.Connecting },
  ) => ({ oldState, newState }),
  ConnectionReady: (
    oldState: VoiceConnectionState,
    newState: VoiceConnectionState & { readonly status: VoiceConnectionStatus.Ready },
  ) => ({ oldState, newState }),
  ConnectionDisconnected: (
    oldState: VoiceConnectionState,
    newState: VoiceConnectionState & { readonly status: VoiceConnectionStatus.Disconnected },
  ) => ({ oldState, newState }),
  ConnectionDestroyed: (
    oldState: VoiceConnectionState,
    newState: VoiceConnectionState & { readonly status: VoiceConnectionStatus.Destroyed },
  ) => ({ oldState, newState }),

  PlayerError: (error: Error) => ({ error }),
})

export type MusicEventConnectionError = typeof MusicEvent.ConnectionError.T

export type MusicEventConnectionSignalling = typeof MusicEvent.ConnectionSignalling.T
export type MusicEventConnectionConnecting = typeof MusicEvent.ConnectionConnecting.T
export type MusicEventConnectionReady = typeof MusicEvent.ConnectionReady.T
export type MusicEventConnectionDisconnected = typeof MusicEvent.ConnectionDisconnected.T
export type MusicEventConnectionDestroyed = typeof MusicEvent.ConnectionDestroyed.T

export type MusicEventPlayerError = typeof MusicEvent.PlayerError.T
