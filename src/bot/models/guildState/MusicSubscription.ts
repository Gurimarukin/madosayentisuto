import type { AudioPlayer, VoiceConnection } from '@discordjs/voice'
import { createAudioPlayer } from '@discordjs/voice'

export type MusicSubscription = {
  readonly voiceConnection: VoiceConnection
  readonly audioPlayer: AudioPlayer
}

const fromVoiceConnection = (voiceConnection: VoiceConnection): MusicSubscription => ({
  voiceConnection,
  audioPlayer: createAudioPlayer(),
})

export const MusicSubscription = { fromVoiceConnection }
