import { boolean, eq, string } from 'fp-ts'
import type { Eq } from 'fp-ts/Eq'
import { pipe } from 'fp-ts/function'

import { Track } from '../../../shared/models/audio/music/Track'
import { List, Maybe, NonEmptyArray } from '../../../shared/utils/fp'

import { MyFile } from '../FileOrDir'
import type { AudioState, AudioStateNotDisconnected } from './AudioState'
import { AudioStateValue } from './AudioStateValue'

type Common = {
  audioStateType: AudioState['type']
  isPaused: boolean
}

type Music = Common & {
  type: 'Music'
  currentTrack: Maybe<Track>
  queue: List<Track>
}

type Elevator = Common & {
  type: 'Elevator'
  playlist: NonEmptyArray<MyFile>
}

type PlayerMessageDeps = Music | Elevator

const musicEq: Eq<Music> = eq.struct<Omit<Music, 'type'>>({
  audioStateType: string.Eq,
  isPaused: boolean.Eq,
  currentTrack: Maybe.getEq(Track.Eq),
  queue: List.getEq(Track.Eq),
})

const elevatorEq: Eq<Elevator> = eq.struct<Omit<Elevator, 'type'>>({
  audioStateType: string.Eq,
  isPaused: boolean.Eq,
  playlist: NonEmptyArray.getEq(MyFile.Eq.byPath),
})

const depsEq: Eq<PlayerMessageDeps> = eq.fromEquals((x, y) => {
  if (x.type !== y.type) return false

  switch (x.type) {
    case 'Music':
      return musicEq.equals(x, y as Music)

    case 'Elevator':
      return elevatorEq.equals(x, y as Elevator)
  }
})

const PlayerMessageDeps = {
  fromState: (state: AudioStateNotDisconnected<AudioStateValue>): PlayerMessageDeps =>
    pipe(
      state.value,
      AudioStateValue.fold<PlayerMessageDeps, PlayerMessageDeps>({
        onMusic: ({ currentTrack, queue, isPaused }) => ({
          audioStateType: state.type,
          isPaused,
          type: 'Music',
          currentTrack,
          queue,
        }),

        onElevator: ({ playlist, isPaused }) => ({
          audioStateType: state.type,
          isPaused,
          type: 'Elevator',
          playlist,
        }),
      }),
    ),

  Eq: depsEq,
}

export { PlayerMessageDeps }
