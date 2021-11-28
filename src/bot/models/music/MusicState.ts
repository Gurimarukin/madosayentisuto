import type { AudioPlayer, PlayerSubscription, VoiceConnection } from '@discordjs/voice'
import type { Message, StageChannel, VoiceChannel } from 'discord.js'
import { pipe } from 'fp-ts/function'

import { List, Maybe } from '../../../shared/utils/fp'

import { createUnion } from '../../utils/createUnion'
import type { Track } from './Track'

type MusicChannel = VoiceChannel | StageChannel

export type MusicState = typeof u.T

export type MusicStateDisconnected = typeof u.Disconnected.T
export type MusicStateConnecting = typeof u.Connecting.T
export type MusicStateConnected = typeof u.Connected.T

type CommonArgs = {
  readonly playing: Maybe<Track>
  readonly queue: List<Track>
  readonly message: Maybe<Message>
}

type DisconnectedArgs = CommonArgs

type ConnectingArgs = CommonArgs & {
  readonly channel: MusicChannel
  readonly voiceConnection: VoiceConnection
  readonly audioPlayer: AudioPlayer
}

type ConnectedArgs = CommonArgs & {
  readonly audioPlayer: AudioPlayer
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
})

const connecting =
  (channel: MusicChannel, voiceConnection: VoiceConnection, audioPlayer: AudioPlayer) =>
  ({ playing, queue, message }: MusicState): MusicStateConnecting =>
    u.Connecting({ playing, queue, message, channel, voiceConnection, audioPlayer })

const connected =
  (audioPlayer: AudioPlayer, subscription: Maybe<PlayerSubscription>) =>
  ({ playing, queue, message }: MusicState): MusicStateConnected =>
    u.Connected({
      playing,
      queue,
      message,
      audioPlayer,
      subscription,
    })

const queueTrack =
  (track: Track) =>
  (state: MusicState): MusicState => ({
    ...state,
    queue: pipe(state.queue, List.append(track)),
  })

const setMessage =
  (message: Maybe<Message>) =>
  (state: MusicState): MusicState => ({ ...state, message })

const setPlaying =
  (playing: Maybe<Track>) =>
  (state: MusicState): MusicState => ({ ...state, playing })

export const MusicState = { empty, connecting, connected, queueTrack, setMessage, setPlaying, ...u }
