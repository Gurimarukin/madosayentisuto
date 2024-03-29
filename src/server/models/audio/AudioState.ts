import type { AudioPlayer, PlayerSubscription, VoiceConnection } from '@discordjs/voice'
import { eq, refinement } from 'fp-ts'
import type { Kind } from 'fp-ts/HKT'
import type { Refinement } from 'fp-ts/Refinement'
import { pipe } from 'fp-ts/function'
import { lens } from 'monocle-ts'
import type { Lens } from 'monocle-ts/Lens'

import { AudioStateView } from '../../../shared/models/audio/AudioStateView'
import type { Maybe } from '../../../shared/utils/fp'

import type { GuildAudioChannel } from '../../utils/ChannelUtils'
import { ChannelUtils } from '../../utils/ChannelUtils'
import type { AudioStateValueMusic, AudioStateValuePlaylist } from './AudioStateValue'
import { AudioStateValue } from './AudioStateValue'

declare module 'fp-ts/HKT' {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface URItoKind<A extends AudioStateValue> {
    readonly [AudioStateConnectingURI]: AudioStateConnecting<A>
  }
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface URItoKind<A extends AudioStateValue> {
    readonly [AudioStateConnectedURI]: AudioStateConnected<A>
  }
}

type AudioState<A extends AudioStateValue = AudioStateValue> =
  | AudioStateDisconnected
  | AudioStateConnecting<A>
  | AudioStateConnected<A>

type AudioStateDisconnected = {
  type: 'Disconnected'
}

const AudioStateConnectingURI = 'AudioStateConnecting' as const
type AudioStateConnectingURI = typeof AudioStateConnectingURI

type AudioStateConnecting<A extends AudioStateValue> = {
  type: 'Connecting'
  channel: GuildAudioChannel
  value: A
  voiceConnection: VoiceConnection
  audioPlayer: AudioPlayer
}

const AudioStateConnectedURI = 'AudioStateConnected' as const
type AudioStateConnectedURI = typeof AudioStateConnectedURI

type AudioStateConnected<A extends AudioStateValue> = {
  type: 'Connected'
  channel: GuildAudioChannel
  value: A
  voiceConnection: VoiceConnection
  audioPlayer: AudioPlayer
  subscription: Maybe<PlayerSubscription>
}

type AudioStateNotDisconnectedURIS = AudioStateConnectingURI | AudioStateConnectedURI

type AudioStateNotDisconnected<A extends AudioStateValue = AudioStateValue> = Kind<
  AudioStateNotDisconnectedURIS,
  A
>

const disconnected: AudioState<never> = { type: 'Disconnected' }

const connecting = <A extends AudioStateValue>(
  channel: GuildAudioChannel,
  value: A,
  voiceConnection: VoiceConnection,
  audioPlayer: AudioPlayer,
): AudioStateConnecting<A> => ({
  type: 'Connecting',
  channel,
  value,
  voiceConnection,
  audioPlayer,
})

const connected = <A extends AudioStateValue>(
  channel: GuildAudioChannel,
  value: A,
  voiceConnection: VoiceConnection,
  audioPlayer: AudioPlayer,
  subscription: Maybe<PlayerSubscription>,
): AudioStateConnected<A> => ({
  type: 'Connected',
  channel,
  value,
  voiceConnection,
  audioPlayer,
  subscription,
})

const isDisconnected = <A extends AudioStateValue>(
  state: AudioState<A>,
): state is AudioStateDisconnected => state.type === 'Disconnected'

const isConnecting = <A extends AudioStateValue>(
  state: AudioState<A>,
): state is AudioStateConnecting<A> => state.type === 'Connecting'

const isConnected = <A extends AudioStateValue>(
  state: AudioState<A>,
): state is AudioStateConnected<A> => state.type === 'Connected'

const isNotConnected: Refinement<AudioState, AudioStateNotDisconnected> =
  refinement.not(isDisconnected)

type FoldArgs<A, B, C> = {
  onDisconnected: () => A
  onConnecting: <S extends AudioStateValue>(s: AudioStateConnecting<S>) => B
  onConnected: <S extends AudioStateValue>(s: AudioStateConnected<S>) => C
}

const fold =
  <A, B = A, C = A>({ onDisconnected, onConnecting, onConnected }: FoldArgs<A, B, C>) =>
  <S extends AudioStateValue>(state: AudioState<S>): A | B | C => {
    switch (state.type) {
      case 'Disconnected':
        return onDisconnected()
      case 'Connecting':
        return onConnecting(state)
      case 'Connected':
        return onConnected(state)
    }
  }

const toView = fold<AudioStateView>({
  onDisconnected: () => AudioStateView.disconnected,
  onConnecting: s =>
    AudioStateView.connecting(ChannelUtils.toView(s.channel), AudioStateValue.toView(s.value)),
  onConnected: s =>
    AudioStateView.connected(ChannelUtils.toView(s.channel), AudioStateValue.toView(s.value)),
})

const Eq: eq.Eq<AudioState> = eq.fromEquals((x, y) => {
  if (x.type !== y.type) return false
  switch (x.type) {
    case 'Disconnected':
      return audioStateDisconnectedEq.equals(x, y as AudioStateDisconnected)
    case 'Connecting':
      return audioStateConnectingEq.equals(x, y as AudioStateConnecting<AudioStateValue>)
    case 'Connected':
      return audioStateConnectedEq.equals(x, y as AudioStateConnected<AudioStateValue>)
  }
})

const eqIgnore: eq.Eq<unknown> = eq.fromEquals(() => true)

const audioStateDisconnectedEq = eq.struct<AudioStateDisconnected>({
  type: eqIgnore,
})

const audioStateConnectingEq = eq.struct<AudioStateConnecting<AudioStateValue>>({
  type: eqIgnore,
  channel: ChannelUtils.Eq.byId,
  value: AudioStateValue.Eq,
  voiceConnection: eqIgnore,
  audioPlayer: eqIgnore,
})

const audioStateConnectedEq = eq.struct<AudioStateConnected<AudioStateValue>>({
  type: eqIgnore,
  channel: ChannelUtils.Eq.byId,
  value: AudioStateValue.Eq,
  voiceConnection: eqIgnore,
  audioPlayer: eqIgnore,
  subscription: eqIgnore,
})

const AudioState = {
  disconnected,
  connecting,
  connected,

  isDisconnected,
  isConnecting,
  isConnected,

  isNotConnected,

  fold,

  toView,
  Eq,
}

type FoldValueArgs<F extends AudioStateNotDisconnectedURIS, A, B> = {
  onMusic: (state: Kind<F, AudioStateValueMusic>) => A
  onPlaylist: (state: Kind<F, AudioStateValuePlaylist>) => B
}

const foldValue =
  <F extends AudioStateNotDisconnectedURIS = AudioStateNotDisconnectedURIS>() =>
  <A, B = A>({ onMusic, onPlaylist }: FoldValueArgs<F, A, B>) =>
  (state: Kind<F, AudioStateValue>) => {
    switch (state.value.type) {
      case 'Music':
        return onMusic(state as Kind<F, AudioStateValueMusic>)
      case 'Playlist':
        return onPlaylist(state as Kind<F, AudioStateValuePlaylist>)
    }
  }

const modifyValue =
  <F extends AudioStateNotDisconnectedURIS = AudioStateNotDisconnectedURIS>() =>
  <A extends AudioStateValue, B extends AudioStateValue>(
    f: (value: A) => B,
  ): ((state: Kind<F, A>) => Kind<F, B>) => {
    const res: (s: Kind<F, A>) => Kind<F, A> = pipe(
      connectValueLens<F, A>(),
      lens.modify(f as unknown as (a: A) => A),
    )
    return res as unknown as (state: Kind<F, A>) => Kind<F, B>
  }

const setValue =
  <F extends AudioStateNotDisconnectedURIS = AudioStateNotDisconnectedURIS>() =>
  <B extends AudioStateValue>(value: B): (<A>(state: Kind<F, A>) => Kind<F, B>) => {
    const res: (s: Kind<F, B>) => Kind<F, B> = connectValueLens<F, B>().set(value)
    return res as <A>(state: Kind<F, A>) => Kind<F, B>
  }

const AudioStateNotDisconnected = {
  foldValue,
  modifyValue,
  setValue,
}

export {
  AudioState,
  AudioStateNotDisconnected,
  type AudioStateConnected,
  type AudioStateConnecting,
  type AudioStateDisconnected,
}

const connectValueLens = <
  F extends AudioStateNotDisconnectedURIS,
  A extends AudioStateValue,
>(): Lens<Kind<F, A>, A> => pipe(lens.id<Kind<F, A>>(), lens.prop('value'))
