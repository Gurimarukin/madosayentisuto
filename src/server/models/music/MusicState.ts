import type { AudioPlayer, PlayerSubscription, VoiceConnection } from '@discordjs/voice'
import type { Message } from 'discord.js'
import type { Endomorphism } from 'fp-ts/Endomorphism'
import { pipe } from 'fp-ts/function'

import { createUnion } from '../../../shared/utils/createUnion'
import { List, Maybe, NonEmptyArray } from '../../../shared/utils/fp'

import type { GuildAudioChannel } from '../../utils/ChannelUtils'
import { AudioPlayerState } from './AudioPlayerState'
import type { Track } from './Track'

export type MusicState = typeof u.T

export type MusicStateDisconnected = typeof u.Disconnected.T
export type MusicStateConnecting = typeof u.Connecting.T
export type MusicStateConnected = typeof u.Connected.T

type CommonArgs = {
  readonly playing: Maybe<Track>
  readonly queue: List<Track>
  readonly message: Maybe<Message<true>>
  readonly pendingEvent: Maybe<string> // because when we call /play, message.thread doesn't exist yet
}

type DisconnectedArgs = CommonArgs

type ConnectingArgs = CommonArgs & {
  readonly channel: GuildAudioChannel
  readonly voiceConnection: VoiceConnection
  readonly audioPlayer: AudioPlayer
}

type ConnectedArgs = CommonArgs & {
  readonly channel: GuildAudioChannel
  readonly voiceConnection: VoiceConnection
  readonly audioPlayerState: AudioPlayerState
  readonly subscription: Maybe<PlayerSubscription>
}

const u = createUnion({
  Disconnected: (args: DisconnectedArgs) => args,
  Connecting: (args: ConnectingArgs) => args,
  Connected: (args: ConnectedArgs) => args,
})

const empty: MusicState = u.Disconnected({
  playing: Maybe.none,
  queue: List.empty,
  message: Maybe.none,
  pendingEvent: Maybe.none,
})

const connecting =
  (channel: GuildAudioChannel, voiceConnection: VoiceConnection, audioPlayer: AudioPlayer) =>
  ({ playing, queue, message, pendingEvent }: MusicState): MusicStateConnecting =>
    u.Connecting({ playing, queue, message, pendingEvent, channel, voiceConnection, audioPlayer })

const connected =
  (
    audioPlayer: AudioPlayer,
    channel: GuildAudioChannel,
    voiceConnection: VoiceConnection,
    subscription: Maybe<PlayerSubscription>,
  ) =>
  ({ playing, queue, message, pendingEvent }: MusicState): MusicStateConnected =>
    u.Connected({
      playing,
      queue,
      message,
      pendingEvent,
      audioPlayerState: AudioPlayerState.Playing(audioPlayer),
      channel,
      voiceConnection,
      subscription,
    })

const getChannel = (state: MusicState): Maybe<GuildAudioChannel> => {
  switch (state.type) {
    case 'Disconnected':
      return Maybe.none

    case 'Connecting':
    case 'Connected':
      return Maybe.some(state.channel)
  }
}

const getVoiceConnection = (state: MusicState): Maybe<VoiceConnection> => {
  switch (state.type) {
    case 'Disconnected':
      return Maybe.none

    case 'Connecting':
    case 'Connected':
      return Maybe.some(state.voiceConnection)
  }
}

const getAudioPlayer = (state: MusicState): Maybe<AudioPlayer> => {
  switch (state.type) {
    case 'Disconnected':
      return Maybe.none

    case 'Connecting':
      return Maybe.some(state.audioPlayer)

    case 'Connected':
      return Maybe.some(state.audioPlayerState.value)
  }
}

const queueTracks =
  (tracks: NonEmptyArray<Track>) =>
  (state: MusicState): MusicState => ({
    ...state,
    queue: pipe(state.queue, NonEmptyArray.concat(tracks)),
  })

const setMessage =
  (message: Maybe<Message<true>>) =>
  (state: MusicState): MusicState => ({ ...state, message })

const setPendingEvent =
  (pendingEvent: Maybe<string>) =>
  (state: MusicState): MusicState => ({ ...state, pendingEvent })

const setPlaying =
  (playing: Maybe<Track>) =>
  (state: MusicState): MusicState => ({ ...state, playing })

const setQueue =
  (queue: List<Track>) =>
  (state: MusicState): MusicState => ({ ...state, queue })

const updateAudioPlayerState =
  (update: Endomorphism<AudioPlayerState>) =>
  (state: MusicState): MusicState => {
    switch (state.type) {
      case 'Disconnected':
      case 'Connecting':
        return state

      case 'Connected':
        return { ...state, audioPlayerState: update(state.audioPlayerState) }
    }
  }

const setAudioPlayerStatePlaying = updateAudioPlayerState(AudioPlayerState.setPlaying)
const setAudioPlayerStatePaused = updateAudioPlayerState(AudioPlayerState.setPaused)

export const MusicState = {
  empty,
  connecting,
  connected,
  getChannel,
  getVoiceConnection,
  getAudioPlayer,
  queueTracks,
  setMessage,
  setPendingEvent,
  setPlaying,
  setQueue,
  setAudioPlayerStatePlaying,
  setAudioPlayerStatePaused,
  ...u,
}
