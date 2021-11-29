import type { AudioPlayer, PlayerSubscription, VoiceConnection } from '@discordjs/voice'
import type { StageChannel, VoiceChannel } from 'discord.js'
import { pipe } from 'fp-ts/function'

import { List, Maybe } from '../../../shared/utils/fp'

import { createUnion } from '../../utils/createUnion'
import type { StateMessages } from './StateMessages'
import type { Track } from './Track'

type MusicChannel = VoiceChannel | StageChannel

export type MusicState = typeof u.T

export type MusicStateDisconnected = typeof u.Disconnected.T
export type MusicStateConnecting = typeof u.Connecting.T
export type MusicStateConnected = typeof u.Connected.T

type CommonArgs = {
  readonly playing: Maybe<Track>
  readonly queue: List<Track>
  readonly messages: Maybe<StateMessages>
}

type DisconnectedArgs = CommonArgs

type ConnectingArgs = CommonArgs & {
  readonly channel: MusicChannel
  readonly voiceConnection: VoiceConnection
  readonly audioPlayer: AudioPlayer
}

type ConnectedArgs = CommonArgs & {
  readonly audioPlayer: AudioPlayer
  readonly voiceConnection: VoiceConnection
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
  messages: Maybe.none,
})

const connecting =
  (channel: MusicChannel, voiceConnection: VoiceConnection, audioPlayer: AudioPlayer) =>
  ({ playing, queue, messages }: MusicState): MusicStateConnecting =>
    u.Connecting({ playing, queue, messages, channel, voiceConnection, audioPlayer })

const connected =
  (
    audioPlayer: AudioPlayer,
    voiceConnection: VoiceConnection,
    subscription: Maybe<PlayerSubscription>,
  ) =>
  ({ playing, queue, messages }: MusicState): MusicStateConnected =>
    u.Connected({
      playing,
      queue,
      messages,
      audioPlayer,
      voiceConnection,
      subscription,
    })

const getVoiceConnection = (state: MusicState): Maybe<VoiceConnection> => {
  switch (state.type) {
    case 'Disconnected':
      return Maybe.none

    case 'Connecting':
    case 'Connected':
      return Maybe.some(state.voiceConnection)
  }
}

const queueTrack =
  (track: Track) =>
  (state: MusicState): MusicState => ({
    ...state,
    queue: pipe(state.queue, List.append(track)),
  })

const setMessages =
  (messages: Maybe<StateMessages>) =>
  (state: MusicState): MusicState => ({ ...state, messages })

const setPlaying =
  (playing: Maybe<Track>) =>
  (state: MusicState): MusicState => ({ ...state, playing })

const setQueue =
  (queue: List<Track>) =>
  (state: MusicState): MusicState => ({ ...state, queue })

export const MusicState = {
  empty,
  connecting,
  connected,
  getVoiceConnection,
  queueTrack,
  setMessages,
  setPlaying,
  setQueue,
  ...u,
}
