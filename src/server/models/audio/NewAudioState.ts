import type { AudioPlayer, PlayerSubscription, VoiceConnection } from '@discordjs/voice'
import { refinement } from 'fp-ts'
import type { Refinement } from 'fp-ts/Refinement'
import { pipe } from 'fp-ts/function'
import { lens } from 'monocle-ts'
import type { Lens } from 'monocle-ts/Lens'

import type { Maybe } from '../../../shared/utils/fp'

import type { GuildAudioChannel } from '../../utils/ChannelUtils'
import type { NewAudioStateValueMusic } from './NewAudioStateValue'
import { NewAudioStateValue } from './NewAudioStateValue'

type NewAudioState<A extends NewAudioStateValue> =
  | NewAudioStateDisconnected
  // | NewAudioStatePreConnecting<A>
  | NewAudioStateConnecting<A>
  | NewAudioStateConnected<A>

type NewAudioStateDisconnected = {
  readonly type: 'Disconnected'
}

// When we don't have a voiceConnection yet
// type NewAudioStatePreConnecting<A extends NewAudioStateValue> = {
//   readonly type: 'PreConnecting'
//   readonly channel: GuildAudioChannel
//   readonly value: A
// }

type NewAudioStateConnecting<A extends NewAudioStateValue> = {
  readonly type: 'Connecting'
  readonly channel: GuildAudioChannel
  readonly value: A
  readonly voiceConnection: VoiceConnection
  readonly audioPlayer: AudioPlayer
}

type NewAudioStateConnected<A extends NewAudioStateValue> = {
  readonly type: 'Connected'
  readonly channel: GuildAudioChannel
  readonly value: A
  readonly voiceConnection: VoiceConnection
  readonly audioPlayer: AudioPlayer
  readonly subscription: Maybe<PlayerSubscription>
}

type NewAudioStateConnect<A extends NewAudioStateValue> =
  // | NewAudioStatePreConnecting<A>
  NewAudioStateConnecting<A> | NewAudioStateConnected<A>

const disconnected: NewAudioState<never> = { type: 'Disconnected' }

// const preConnecting = <A extends NewAudioStateValue>(
//   channel: GuildAudioChannel,
//   value: A,
// ): NewAudioStatePreConnecting<A> => ({
//   type: 'PreConnecting',
//   channel,
//   value,
// })

const connecting = <A extends NewAudioStateValue>(
  channel: GuildAudioChannel,
  value: A,
  voiceConnection: VoiceConnection,
  audioPlayer: AudioPlayer,
): NewAudioStateConnecting<A> => ({
  type: 'Connecting',
  channel,
  value,
  voiceConnection,
  audioPlayer,
})

const connected = <A extends NewAudioStateValue>(
  channel: GuildAudioChannel,
  value: A,
  voiceConnection: VoiceConnection,
  audioPlayer: AudioPlayer,
  subscription: Maybe<PlayerSubscription>,
): NewAudioStateConnected<A> => ({
  type: 'Connected',
  channel,
  value,
  voiceConnection,
  audioPlayer,
  subscription,
})

const isDisconnected = <A extends NewAudioStateValue>(
  state: NewAudioState<A>,
): state is NewAudioStateDisconnected => state.type === 'Disconnected'

// const isPreConnecting = <A extends NewAudioStateValue>(
//   state: NewAudioState<A>,
// ): state is NewAudioStatePreConnecting<A> => state.type === 'PreConnecting'

const isConnecting = <A extends NewAudioStateValue>(
  state: NewAudioState<A>,
): state is NewAudioStateConnecting<A> => state.type === 'Connecting'

const isConnected = <A extends NewAudioStateValue>(
  state: NewAudioState<A>,
): state is NewAudioStateConnected<A> => state.type === 'Connected'

const isConnect: Refinement<
  NewAudioState<NewAudioStateValue>,
  NewAudioStateConnect<NewAudioStateValue>
  // > = pipe(isPreConnecting, refinement.or(isConnecting), refinement.or(isConnected))
> = refinement.not(isDisconnected)

const isMusicValue = pipe(
  isConnect,
  refinement.compose((s): s is NewAudioStateConnect<NewAudioStateValueMusic> =>
    NewAudioStateValue.is('Music')(s.value),
  ),
)

type FoldArgs<A, B, C> = {
  readonly onDisconnected: () => A
  // readonly onPreConnecting: <S extends NewAudioStateValue>(s: NewAudioStatePreConnecting<S>) => B
  readonly onConnecting: <S extends NewAudioStateValue>(s: NewAudioStateConnecting<S>) => B
  readonly onConnected: <S extends NewAudioStateValue>(s: NewAudioStateConnected<S>) => C
}

const fold =
  <A, B = A, C = A>({
    onDisconnected,
    // onPreConnecting,
    onConnecting,
    onConnected,
  }: FoldArgs<A, B, C>) =>
  <S extends NewAudioStateValue>(state: NewAudioState<S>): A | B | C => {
    switch (state.type) {
      case 'Disconnected':
        return onDisconnected()
      // case 'PreConnecting':
      //   return onPreConnecting(state)
      case 'Connecting':
        return onConnecting(state)
      case 'Connected':
        return onConnected(state)
    }
  }

const NewAudioState = {
  disconnected,
  // preConnecting,
  connecting,
  connected,

  isDisconnected,
  // isPreConnecting,
  isConnecting,
  isConnected,

  isConnect,
  isMusicValue,

  fold,

  modifyValue,
}

function modifyValue<
  A extends NewAudioStateValue,
  B extends NewAudioStateValue,
  T extends NewAudioStateConnect<A>,
  U extends NewAudioStateConnect<B>,
>(f: (value: A) => B): (state: T) => U {
  const res: (s: NewAudioStateConnect<A>) => NewAudioStateConnect<A> = pipe(
    connectValueLens<A>(),
    lens.modify(f as unknown as (a: A) => A),
  )
  return res as unknown as (state: T) => U
}

const NewAudioStateConnect = {
  modifyValue,
}

export {
  NewAudioState,
  NewAudioStateDisconnected,
  // NewAudioStatePreConnecting,
  NewAudioStateConnecting,
  NewAudioStateConnected,
  NewAudioStateConnect,
}

const connectValueLens = <A extends NewAudioStateValue>(): Lens<NewAudioStateConnect<A>, A> =>
  pipe(lens.id<NewAudioStateConnect<A>>(), lens.prop('value'))

// function preConnectingValueLens<A extends NewAudioStateValue>(): Lens<
//   NewAudioStatePreConnecting<A>,
//   A
// > {
//   return pipe(lens.id<NewAudioStatePreConnecting<A>>(), lens.prop('value'))
// }

function connectingValueLens<A extends NewAudioStateValue>(): Lens<NewAudioStateConnecting<A>, A> {
  return pipe(lens.id<NewAudioStateConnecting<A>>(), lens.prop('value'))
}

function connectedValueLens<A extends NewAudioStateValue>(): Lens<NewAudioStateConnected<A>, A> {
  return pipe(lens.id<NewAudioStateConnected<A>>(), lens.prop('value'))
}
