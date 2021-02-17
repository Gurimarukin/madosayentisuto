import { VoiceState } from 'discord.js'

export interface VoiceStateUpdate {
  readonly oldState: VoiceState
  readonly newState: VoiceState
}

export const VoiceStateUpdate = (oldState: VoiceState, newState: VoiceState): VoiceStateUpdate => ({
  oldState,
  newState,
})
