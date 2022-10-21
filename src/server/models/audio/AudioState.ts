import type { AudioPlayer, PlayerSubscription, VoiceConnection } from '@discordjs/voice'
import { refinement } from 'fp-ts'
import type { Kind } from 'fp-ts/HKT'
import type { Refinement } from 'fp-ts/Refinement'
import { pipe } from 'fp-ts/function'
import { lens } from 'monocle-ts'
import type { Lens } from 'monocle-ts/Lens'

import type { Maybe } from '../../../shared/utils/fp'

import type { GuildAudioChannel } from '../../utils/ChannelUtils'
import type { AudioStateValueElevator, AudioStateValueMusic } from './AudioStateValue'
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
  readonly type: 'Disconnected'
}

const AudioStateConnectingURI = 'AudioStateConnecting' as const
type AudioStateConnectingURI = typeof AudioStateConnectingURI

type AudioStateConnecting<A extends AudioStateValue> = {
  readonly type: 'Connecting'
  readonly channel: GuildAudioChannel
  readonly value: A
  readonly voiceConnection: VoiceConnection
  readonly audioPlayer: AudioPlayer
}

const AudioStateConnectedURI = 'AudioStateConnected' as const
type AudioStateConnectedURI = typeof AudioStateConnectedURI

type AudioStateConnected<A extends AudioStateValue> = {
  readonly type: 'Connected'
  readonly channel: GuildAudioChannel
  readonly value: A
  readonly voiceConnection: VoiceConnection
  readonly audioPlayer: AudioPlayer
  readonly subscription: Maybe<PlayerSubscription>
}

type AudioStateConnectedURIS = AudioStateConnectingURI | AudioStateConnectedURI

type AudioStateConnect<A extends AudioStateValue = AudioStateValue> = Kind<
  AudioStateConnectedURIS,
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

const isConnect: Refinement<AudioState, AudioStateConnect> = refinement.not(isDisconnected)

const isMusicValue = pipe(
  isConnect,
  refinement.compose((s): s is AudioStateConnect<AudioStateValueMusic> =>
    AudioStateValue.is('Music')(s.value),
  ),
)

type FoldArgs<A, B, C> = {
  readonly onDisconnected: () => A
  readonly onConnecting: <S extends AudioStateValue>(s: AudioStateConnecting<S>) => B
  readonly onConnected: <S extends AudioStateValue>(s: AudioStateConnected<S>) => C
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

const AudioState = {
  disconnected,
  connecting,
  connected,

  isDisconnected,
  isConnecting,
  isConnected,

  isConnect,
  isMusicValue,

  fold,
}

type FoldValueArgs<F extends AudioStateConnectedURIS, A, B> = {
  readonly onMusic: (state: Kind<F, AudioStateValueMusic>) => A
  readonly onElevator: (state: Kind<F, AudioStateValueElevator>) => B
}

const foldValue =
  <F extends AudioStateConnectedURIS = AudioStateConnectedURIS>() =>
  <A, B = A>({ onMusic, onElevator }: FoldValueArgs<F, A, B>) =>
  (state: Kind<F, AudioStateValue>) => {
    switch (state.value.type) {
      case 'Music':
        return onMusic(state as Kind<F, AudioStateValueMusic>)
      case 'Elevator':
        return onElevator(state as Kind<F, AudioStateValueElevator>)
    }
  }

const modifyValue =
  <F extends AudioStateConnectedURIS = AudioStateConnectedURIS>() =>
  <A extends AudioStateValue, B extends AudioStateValue>(
    f: (value: A) => B,
  ): ((state: Kind<F, A>) => Kind<F, B>) => {
    const res: (s: Kind<F, A>) => Kind<F, A> = pipe(
      connectValueLens<F, A>(),
      lens.modify(f as unknown as (a: A) => A),
    )
    return res as unknown as (state: Kind<F, A>) => Kind<F, B>
  }

const AudioStateConnect = {
  foldValue,
  modifyValue,
}

export {
  AudioState,
  AudioStateDisconnected,
  AudioStateConnecting,
  AudioStateConnected,
  AudioStateConnect,
}

const connectValueLens = <F extends AudioStateConnectedURIS, A extends AudioStateValue>(): Lens<
  Kind<F, A>,
  A
> => pipe(lens.id<Kind<F, A>>(), lens.prop('value'))