import type { AudioPlayer, PlayerSubscription, VoiceConnection } from '@discordjs/voice'
import type { Endomorphism } from 'fp-ts/Endomorphism'
import { flow, pipe } from 'fp-ts/function'
import { lens } from 'monocle-ts'
import type { Lens } from 'monocle-ts/Lens'

import { createUnion } from '../../../shared/utils/createUnion'
import { Maybe } from '../../../shared/utils/fp'

import type { GuildAudioChannel } from '../../utils/ChannelUtils'
import { AudioStateType } from './AudioStateType'

export type AudioState = typeof u.T

export type AudioStateDisconnected = typeof u.Disconnected.T
export type AudioStateConnecting = typeof u.Connecting.T
export type AudioStateConnected = typeof u.Connected.T

type AudioStateConnect = AudioStateConnecting | AudioStateConnected

type CommonArgs = {
  readonly value: AudioStateType
}

type ConnectArgs = {
  readonly channel: GuildAudioChannel
  readonly voiceConnection: VoiceConnection
  readonly audioPlayer: AudioPlayer
}

//

type DisconnectedArgs = CommonArgs

type ConnectingArgs = CommonArgs & ConnectArgs

type ConnectedArgs = CommonArgs &
  ConnectArgs & {
    readonly subscription: Maybe<PlayerSubscription>
  }

const u = createUnion({
  Disconnected: (args: DisconnectedArgs) => args,
  Connecting: (args: ConnectingArgs) => args,
  Connected: (args: ConnectedArgs) => args,
})

const empty: AudioStateDisconnected = u.Disconnected({ value: AudioStateType.Music.empty })

const connecting =
  (channel: GuildAudioChannel, voiceConnection: VoiceConnection, audioPlayer: AudioPlayer) =>
  ({ value }: AudioState): AudioStateConnecting =>
    u.Connecting({ channel, voiceConnection, audioPlayer, value })

const connected =
  (
    audioPlayer: AudioPlayer,
    channel: GuildAudioChannel,
    voiceConnection: VoiceConnection,
    subscription: Maybe<PlayerSubscription>,
  ) =>
  ({ value }: AudioState): AudioStateConnected =>
    u.Connected({ channel, voiceConnection, audioPlayer, value, subscription })

const getAudioStateConnect = (state: AudioState): Maybe<AudioStateConnect> => {
  switch (state.type) {
    case 'Disconnected':
      return Maybe.none
    case 'Connecting':
    case 'Connected':
      return Maybe.some(state)
  }
}

const valueLens: Lens<AudioState, AudioStateType> = pipe(lens.id<AudioState>(), lens.prop('value'))

const modifyValue = (f: Endomorphism<AudioStateType>): Endomorphism<AudioState> =>
  pipe(valueLens, lens.modify(f))

// const setMusicPlaying = modifyValue(AudioStateType.setMusicPlaying)
// const setMusicPaused = modifyValue(AudioStateType.setMusicPaused)

export const AudioState = {
  is: u.is,

  empty,
  connecting,
  connected,

  value: {
    set: valueLens.set,

    Music: {
      isPaused: {
        set: flow(AudioStateType.Music.isPaused.set, modifyValue),
      },
      currentTrack: {
        get: flow(valueLens.get, AudioStateType.Music.currentTrack.get),
        set: flow(AudioStateType.Music.currentTrack.set, modifyValue),
      },
      queue: {
        get: flow(valueLens.get, AudioStateType.Music.queue.get),
        set: flow(AudioStateType.Music.queue.set, modifyValue),
        concat: flow(AudioStateType.Music.queue.concat, modifyValue),
      },
      messageChannel: {
        set: flow(AudioStateType.Music.messageChannel.set, modifyValue),
      },
      message: {
        get: flow(valueLens.get, AudioStateType.Music.message.get),
        set: flow(AudioStateType.Music.message.set, modifyValue),
      },
      pendingEvent: {
        get: flow(valueLens.get, AudioStateType.Music.pendingEvent.get),
        set: flow(AudioStateType.Music.pendingEvent.set, modifyValue),
      },
    },

    Elevator: {
      currentFile: {
        get: flow(valueLens.get, AudioStateType.Elevator.currentFile.get),
        set: flow(AudioStateType.Elevator.currentFile.set, modifyValue),
      },
    },
  },

  channel: {
    get: flow(
      getAudioStateConnect,
      Maybe.map(connect => connect.channel),
    ),
  },
  voiceConnection: {
    get: flow(
      getAudioStateConnect,
      Maybe.map(connect => connect.voiceConnection),
    ),
  },
  audioPlayer: {
    get: flow(
      getAudioStateConnect,
      Maybe.map(connect => connect.audioPlayer),
    ),
  },
}
