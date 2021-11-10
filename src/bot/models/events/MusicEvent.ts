import type { VoiceConnectionState, VoiceConnectionStatus } from '@discordjs/voice'

export type MusicEvent = MusicError | VoiceConnectionReady

export type MusicError = {
  readonly type: 'MusicError'
  readonly error: Error
}
const MusicError = (error: Error): MusicError => ({ type: 'MusicError', error })

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
  MusicError,
  VoiceConnectionReady,
}
