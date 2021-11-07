import { AudioPlayer, VoiceConnection } from '@discordjs/voice'

export type MusicSubscription = {
  readonly voiceConnection: VoiceConnection
  readonly audioPlayer: AudioPlayer
}
