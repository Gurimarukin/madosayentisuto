import type { AudioPlayer, PlayerSubscription, VoiceConnection } from '@discordjs/voice'
import { refinement } from 'fp-ts'
import type { Refinement } from 'fp-ts/Refinement'
import { pipe } from 'fp-ts/function'
import { lens } from 'monocle-ts'
import type { Lens } from 'monocle-ts/Lens'

import type { Maybe } from '../../../shared/utils/fp'

import type { GuildAudioChannel } from '../../utils/ChannelUtils'
import type { NewAudioStateValueElevator, NewAudioStateValueMusic } from './NewAudioStateValue'
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
}

type FoldValueArgs<
  T extends NewAudioStateConnect<NewAudioStateValueMusic>,
  U extends NewAudioStateConnect<NewAudioStateValueElevator>,
  A,
  B,
> = {
  readonly onMusic: (state: T) => A
  readonly onElevator: (state: U) => B
}

// TODO: we could probably generalize it to all Connect, but we only need Connecting for now.
function foldValue<A, B = A>({
  onMusic,
  onElevator,
}: FoldValueArgs<
  NewAudioStateConnecting<NewAudioStateValueMusic>,
  NewAudioStateConnecting<NewAudioStateValueElevator>,
  A,
  B
>): (state: NewAudioStateConnecting<NewAudioStateValue>) => A | B {
  return state => {
    switch (state.value.type) {
      case 'Music':
        return onMusic(state as NewAudioStateConnecting<NewAudioStateValueMusic>)
      case 'Elevator':
        return onElevator(state as NewAudioStateConnecting<NewAudioStateValueElevator>)
    }
  }
}

const modifyValue = <
  A extends NewAudioStateValue,
  B extends NewAudioStateValue,
  T extends NewAudioStateConnect<A>,
  U extends NewAudioStateConnect<B>,
>(
  f: (value: A) => B,
): ((state: T) => U) => {
  const res: (s: NewAudioStateConnect<A>) => NewAudioStateConnect<A> = pipe(
    connectValueLens<A>(),
    lens.modify(f as unknown as (a: A) => A),
  )
  return res as unknown as (state: T) => U
}

const NewAudioStateConnect = {
  foldValue,
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
