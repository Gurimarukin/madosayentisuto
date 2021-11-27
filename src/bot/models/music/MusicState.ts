import type { AudioPlayer, PlayerSubscription, VoiceConnection } from '@discordjs/voice'
import type { StageChannel, VoiceChannel } from 'discord.js'

import type { Maybe } from '../../../shared/utils/fp'

import { createUnion } from '../../utils/createUnion'

type MyChannel = VoiceChannel | StageChannel

export type MusicState = typeof MusicState.T

export const MusicState = createUnion({
  Disconnected: () => ({}),

  Connecting: (channel: MyChannel, voiceConnection: VoiceConnection, audioPlayer: AudioPlayer) => ({
    channel,
    voiceConnection,
    audioPlayer,
  }),

  Connected: (audioPlayer: AudioPlayer, subcription: Maybe<PlayerSubscription>) => ({
    audioPlayer,
    subcription,
  }),
})

export type MusicStateDisconnected = typeof MusicState.Disconnected.T
export type MusicStateConnecting = typeof MusicState.Connecting.T
export type MusicStateConnected = typeof MusicState.Connected.T
