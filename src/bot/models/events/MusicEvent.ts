import type {
  AudioPlayerState,
  AudioPlayerStatus,
  VoiceConnectionState,
  VoiceConnectionStatus,
} from '@discordjs/voice'

import { createUnion } from '../../utils/createUnion'

type DetVoiceConnectionState<S extends VoiceConnectionState['status']> = VoiceConnectionState & {
  readonly status: S
}
type DetAudioPlayerState<S extends AudioPlayerState['status']> = AudioPlayerState & {
  readonly status: S
}

export type MusicEvent = typeof MusicEvent.T

export const MusicEvent = createUnion({
  // VoiceConnection
  ConnectionError: (error: Error) => ({ error }),
  ConnectionSignalling: (
    oldState: VoiceConnectionState,
    newState: DetVoiceConnectionState<VoiceConnectionStatus.Signalling>,
  ) => ({ oldState, newState }),
  ConnectionConnecting: (
    oldState: VoiceConnectionState,
    newState: DetVoiceConnectionState<VoiceConnectionStatus.Connecting>,
  ) => ({ oldState, newState }),
  ConnectionReady: (
    oldState: VoiceConnectionState,
    newState: DetVoiceConnectionState<VoiceConnectionStatus.Ready>,
  ) => ({ oldState, newState }),
  ConnectionDisconnected: (
    oldState: VoiceConnectionState,
    newState: DetVoiceConnectionState<VoiceConnectionStatus.Disconnected>,
  ) => ({ oldState, newState }),
  ConnectionDestroyed: (
    oldState: VoiceConnectionState,
    newState: DetVoiceConnectionState<VoiceConnectionStatus.Destroyed>,
  ) => ({ oldState, newState }),

  // AudioPlayer
  PlayerError: (error: Error) => ({ error }),
  PlayerIdle: (
    oldState: AudioPlayerState,
    newState: DetAudioPlayerState<AudioPlayerStatus.Idle>,
  ) => ({ oldState, newState }),
  PlayerBuffering: (
    oldState: AudioPlayerState,
    newState: DetAudioPlayerState<AudioPlayerStatus.Buffering>,
  ) => ({ oldState, newState }),
  PlayerPaused: (
    oldState: AudioPlayerState,
    newState: DetAudioPlayerState<AudioPlayerStatus.Paused>,
  ) => ({ oldState, newState }),
  PlayerPlaying: (
    oldState: AudioPlayerState,
    newState: DetAudioPlayerState<AudioPlayerStatus.Playing>,
  ) => ({ oldState, newState }),
  PlayerAutoPaused: (
    oldState: AudioPlayerState,
    newState: DetAudioPlayerState<AudioPlayerStatus.AutoPaused>,
  ) => ({ oldState, newState }),
})

export type MusicEventConnectionError = typeof MusicEvent.ConnectionError.T
export type MusicEventConnectionSignalling = typeof MusicEvent.ConnectionSignalling.T
export type MusicEventConnectionConnecting = typeof MusicEvent.ConnectionConnecting.T
export type MusicEventConnectionReady = typeof MusicEvent.ConnectionReady.T
export type MusicEventConnectionDisconnected = typeof MusicEvent.ConnectionDisconnected.T
export type MusicEventConnectionDestroyed = typeof MusicEvent.ConnectionDestroyed.T

export type MusicEventPlayerError = typeof MusicEvent.PlayerError.T
export type MusicEventPlayerIdle = typeof MusicEvent.PlayerIdle.T
export type MusicEventPlayerBuffering = typeof MusicEvent.PlayerBuffering.T
export type MusicEventPlayerPaused = typeof MusicEvent.PlayerPaused.T
export type MusicEventPlayerPlaying = typeof MusicEvent.PlayerPlaying.T
export type MusicEventPlayerAutoPaused = typeof MusicEvent.PlayerAutoPaused.T
