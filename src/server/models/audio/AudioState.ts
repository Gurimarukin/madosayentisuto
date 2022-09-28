import type { AudioPlayer, PlayerSubscription, VoiceConnection } from '@discordjs/voice'
import type { Message } from 'discord.js'
import type { Endomorphism } from 'fp-ts/Endomorphism'
import { flow, pipe } from 'fp-ts/function'
import { lens } from 'monocle-ts'
import type { Lens } from 'monocle-ts/Lens'

import { createUnion } from '../../../shared/utils/createUnion'
import type { List, NonEmptyArray } from '../../../shared/utils/fp'
import { Maybe } from '../../../shared/utils/fp'

import type { GuildAudioChannel } from '../../utils/ChannelUtils'
import { AudioStateType } from './AudioStateType'
import type { Track } from './music/Track'

export type AudioState = typeof u.T

export type AudioStateDisconnected = typeof u.Disconnected.T
export type AudioStateConnecting = typeof u.Connecting.T
export type AudioStateConnected = typeof u.Connected.T

type AudioStateConnect = AudioStateConnecting | AudioStateConnected

type ConnectArgs = {
  readonly value: AudioStateType
  readonly channel: GuildAudioChannel
  readonly voiceConnection: VoiceConnection
  readonly audioPlayer: AudioPlayer
}

//

type DisconnectedArgs = {
  readonly value: Maybe<AudioStateType>
}

type ConnectingArgs = ConnectArgs

type ConnectedArgs = ConnectArgs & {
  readonly subscription: Maybe<PlayerSubscription>
}

const u = createUnion({
  Disconnected: (args: DisconnectedArgs) => args,
  Connecting: (args: ConnectingArgs) => args,
  Connected: (args: ConnectedArgs) => args,
})

const empty: AudioStateDisconnected = u.Disconnected({ value: Maybe.none })

const connecting =
  (channel: GuildAudioChannel, voiceConnection: VoiceConnection, audioPlayer: AudioPlayer) =>
  (value: AudioStateType): AudioStateConnecting =>
    u.Connecting({ channel, voiceConnection, audioPlayer, value })

const connected =
  (
    audioPlayer: AudioPlayer,
    channel: GuildAudioChannel,
    voiceConnection: VoiceConnection,
    subscription: Maybe<PlayerSubscription>,
  ) =>
  (value: AudioStateType): AudioStateConnected =>
    u.Connected({ channel, voiceConnection, audioPlayer, value, subscription })

const getValue = (state: AudioState): Maybe<AudioStateType> => {
  switch (state.type) {
    case 'Disconnected':
      return state.value
    case 'Connecting':
    case 'Connected':
      return Maybe.some(state.value)
  }
}

const modifyValue =
  (f: Endomorphism<AudioStateType>) =>
  (state: AudioState): AudioState => {
    switch (state.type) {
      case 'Disconnected':
        return pipe(
          disconnectedValueLens,
          lens.modify(
            flow(
              Maybe.getOrElseW(() => AudioStateType.musicEmpty),
              f,
              Maybe.some,
            ),
          ),
        )(state)
      case 'Connecting':
      case 'Connected':
        return pipe(connectValueLens, lens.modify(f))(state)
    }
  }

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

const getCurrentTrack = flow(getValue, Maybe.chain(AudioStateType.getCurrentTrack))
const getQueue = flow(getValue, Maybe.chain(AudioStateType.getQueue))
const getMessage = flow(getValue, Maybe.chain(AudioStateType.getMessage))
const getPendingEvent = flow(getValue, Maybe.chain(AudioStateType.getPendingEvent))

const queueTracks = (tracks: NonEmptyArray<Track>): Endomorphism<AudioState> =>
  modifyValue(AudioStateType.queueTracks(tracks))

const setAudioPlayerStatePlaying = modifyValue(AudioStateType.setPlaying)
const setAudioPlayerStatePaused = modifyValue(AudioStateType.setPaused)

const setCurrentTrack = (currentTrack: Maybe<Track>): Endomorphism<AudioState> =>
  modifyValue(AudioStateType.setCurrentTrack(currentTrack))

const setQueue = (queue: List<Track>): Endomorphism<AudioState> =>
  modifyValue(AudioStateType.setQueue(queue))

const setMessage = (message: Maybe<Message<true>>): Endomorphism<AudioState> =>
  modifyValue(AudioStateType.setMessage(message))

const setPendingEvent = (pendingEvent: Maybe<string>): Endomorphism<AudioState> =>
  modifyValue(AudioStateType.setPendingEvent(pendingEvent))

export const AudioState = {
  is: u.is,

  empty,
  connecting,
  connected,

  getValue,

  getChannel,
  getVoiceConnection,
  getAudioPlayer,
  getCurrentTrack,
  getQueue,
  getMessage,
  getPendingEvent,

  queueTracks,
  setCurrentTrack,
  setQueue,
  setMessage,
  setPendingEvent,
  setAudioPlayerStatePlaying,
  setAudioPlayerStatePaused,
}

const disconnectedValueLens: Lens<AudioStateDisconnected, Maybe<AudioStateType>> = pipe(
  lens.id<AudioStateDisconnected>(),
  lens.prop('value'),
)

const connectValueLens: Lens<AudioStateConnect, AudioStateType> = pipe(
  lens.id<AudioStateConnect>(),
  lens.prop('value'),
)
