import type {
  AudioPlayerState,
  AudioPlayerStatus,
  VoiceConnectionState,
  VoiceConnectionStatus,
} from '@discordjs/voice'

import { createUnion } from '../../../shared/utils/createUnion'

type DetVoiceConnectionState<S extends VoiceConnectionState['status']> = VoiceConnectionState & {
  readonly status: S
}
type DetAudioPlayerState<S extends AudioPlayerState['status']> = AudioPlayerState & {
  readonly status: S
}

type AudioEvent = typeof AudioEvent.T

const AudioEvent = createUnion({
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

export { AudioEvent }

export type AudioEventConnectionError = typeof AudioEvent.ConnectionError.T
export type AudioEventConnectionSignalling = typeof AudioEvent.ConnectionSignalling.T
export type AudioEventConnectionConnecting = typeof AudioEvent.ConnectionConnecting.T
export type AudioEventConnectionReady = typeof AudioEvent.ConnectionReady.T
export type AudioEventConnectionDisconnected = typeof AudioEvent.ConnectionDisconnected.T
export type AudioEventConnectionDestroyed = typeof AudioEvent.ConnectionDestroyed.T

export type AudioEventPlayerError = typeof AudioEvent.PlayerError.T
export type AudioEventPlayerIdle = typeof AudioEvent.PlayerIdle.T
export type AudioEventPlayerBuffering = typeof AudioEvent.PlayerBuffering.T
export type AudioEventPlayerPaused = typeof AudioEvent.PlayerPaused.T
export type AudioEventPlayerPlaying = typeof AudioEvent.PlayerPlaying.T
export type AudioEventPlayerAutoPaused = typeof AudioEvent.PlayerAutoPaused.T
