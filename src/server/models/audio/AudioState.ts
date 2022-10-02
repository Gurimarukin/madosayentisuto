import type { AudioPlayer, PlayerSubscription, VoiceConnection } from '@discordjs/voice'
import type { Message } from 'discord.js'
import type { Endomorphism } from 'fp-ts/Endomorphism'
import { flow, pipe } from 'fp-ts/function'
import { lens } from 'monocle-ts'
import type { Lens } from 'monocle-ts/Lens'

import { createUnion } from '../../../shared/utils/createUnion'
import type { List, NonEmptyArray } from '../../../shared/utils/fp'
import { Maybe } from '../../../shared/utils/fp'

import type { GuildAudioChannel, GuildSendableChannel } from '../../utils/ChannelUtils'
import { AudioStateType } from './AudioStateType'
import type { Track } from './music/Track'

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

const empty: AudioStateDisconnected = u.Disconnected({ value: AudioStateType.musicEmpty })

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

const getChannel = flow(
  getAudioStateConnect,
  Maybe.map(connect => connect.channel),
)

const getVoiceConnection = flow(
  getAudioStateConnect,
  Maybe.map(connect => connect.voiceConnection),
)

const getAudioPlayer = flow(
  getAudioStateConnect,
  Maybe.map(connect => connect.audioPlayer),
)

const valueLens: Lens<AudioState, AudioStateType> = pipe(lens.id<AudioState>(), lens.prop('value'))

const getMusicCurrentTrack = flow(valueLens.get, AudioStateType.getMusicCurrentTrack)
const getMusicQueue = flow(valueLens.get, AudioStateType.getMusicQueue)
const getMusicMessage = flow(valueLens.get, AudioStateType.getMusicMessage)
const getMusicPendingEvent = flow(valueLens.get, AudioStateType.getMusicPendingEvent)

const modifyValue = (f: Endomorphism<AudioStateType>): Endomorphism<AudioState> =>
  pipe(valueLens, lens.modify(f))

const setMusicPlaying = modifyValue(AudioStateType.setMusicPlaying)
const setMusicPaused = modifyValue(AudioStateType.setMusicPaused)

const setMusicCurrentTrack = (currentTrack: Maybe<Track>): Endomorphism<AudioState> =>
  modifyValue(AudioStateType.setMusicCurrentTrack(currentTrack))

const setMusicQueue = (queue: List<Track>): Endomorphism<AudioState> =>
  modifyValue(AudioStateType.setMusicQueue(queue))

const setMusicMessageChannel = (
  messageChannel: Maybe<GuildSendableChannel>,
): Endomorphism<AudioState> => modifyValue(AudioStateType.setMusicMessageChannel(messageChannel))

const setMusicMessage = (message: Maybe<Message<true>>): Endomorphism<AudioState> =>
  modifyValue(AudioStateType.setMusicMessage(message))

const setMusicPendingEvent = (pendingEvent: Maybe<string>): Endomorphism<AudioState> =>
  modifyValue(AudioStateType.setMusicPendingEvent(pendingEvent))

const musicQueueTracks = (tracks: NonEmptyArray<Track>): Endomorphism<AudioState> =>
  modifyValue(AudioStateType.musicQueueTracks(tracks))

export const AudioState = {
  is: u.is,

  empty,
  connecting,
  connected,

  getChannel,
  getVoiceConnection,
  getAudioPlayer,

  getMusicCurrentTrack,
  getMusicQueue,
  getMusicMessage,
  getMusicPendingEvent,

  setMusicCurrentTrack,
  setMusicQueue,
  setMusicMessageChannel,
  setMusicMessage,
  setMusicPendingEvent,
  setMusicPlaying,
  setMusicPaused,
  musicQueueTracks,

  value: {
    set: valueLens.set,
    Elevator: {
      currentFile: {
        get: flow(valueLens.get, AudioStateType.Elevator.currentFile.get),
        set: flow(AudioStateType.Elevator.currentFile.set, modifyValue),
      },
    },
  },
}
