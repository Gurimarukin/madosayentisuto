import type { AudioPlayer } from '@discordjs/voice'

import { createUnion } from '../../utils/createUnion'

export type AudioPlayerState = typeof u.T

export type AudioPlayerStatePlaying = typeof u.Playing.T
export type AudioPlayerStatePaused = typeof u.Paused.T

const u = createUnion({
  Playing: (value: AudioPlayer) => ({ value }),
  Paused: (value: AudioPlayer) => ({ value }),
})

const setPlaying = ({ value }: AudioPlayerState): AudioPlayerStatePlaying => u.Playing(value)

const setPaused = ({ value }: AudioPlayerState): AudioPlayerStatePaused => u.Paused(value)

export const AudioPlayerState = { ...u, setPlaying, setPaused }
