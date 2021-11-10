import type { VoiceConnectionState, VoiceConnectionStatus } from '@discordjs/voice'

export type MusicEvent = ConnectionError | VoiceConnectionReady | PlayerError

export type ConnectionError = {
  readonly type: 'ConnectionError'
  readonly error: Error
}
const ConnectionError = (error: Error): ConnectionError => ({ type: 'ConnectionError', error })

export type PlayerError = {
  readonly type: 'PlayerError'
  readonly error: Error
}
const PlayerError = (error: Error): PlayerError => ({ type: 'PlayerError', error })

export type VoiceConnectionReady = {
  readonly type: 'VoiceConnectionReady'
  readonly oldState: VoiceConnectionState
  readonly newState: VoiceConnectionState & { readonly status: VoiceConnectionStatus.Ready }
}
const VoiceConnectionReady = (
  oldState: VoiceConnectionState,
  newState: VoiceConnectionState & { readonly status: VoiceConnectionStatus.Ready },
): VoiceConnectionReady => ({
  type: 'VoiceConnectionReady',
  oldState,
  newState,
})

export const MusicEvent = {
  ConnectionError,
  PlayerError,
  VoiceConnectionReady,
}
