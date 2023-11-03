import { boolean, eq, string } from 'fp-ts'
import type { Eq } from 'fp-ts/Eq'
import { pipe } from 'fp-ts/function'

import { Track } from '../../../shared/models/audio/music/Track'
import { List, Maybe, NonEmptyArray } from '../../../shared/utils/fp'

import { MyFile } from '../FileOrDir'
import type { AudioState, AudioStateNotDisconnected } from './AudioState'
import { AudioStateValue } from './AudioStateValue'
import type { PlaylistType } from './PlaylistType'

type Common = {
  audioStateType: AudioState['type']
  isPaused: boolean
}

type Music = Common & {
  type: 'Music'
  currentTrack: Maybe<Track>
  queue: List<Track>
}

type Playlist = Common & {
  type: 'Playlist'
  playlistType: PlaylistType
  files: NonEmptyArray<MyFile>
}

type PlayerMessageDeps = Music | Playlist

const musicEq: Eq<Music> = eq.struct<Omit<Music, 'type'>>({
  audioStateType: string.Eq,
  isPaused: boolean.Eq,
  currentTrack: Maybe.getEq(Track.Eq),
  queue: List.getEq(Track.Eq),
})

const playlistEq: Eq<Playlist> = eq.struct<Omit<Playlist, 'type'>>({
  audioStateType: string.Eq,
  isPaused: boolean.Eq,
  playlistType: string.Eq,
  files: NonEmptyArray.getEq(MyFile.Eq.byPath),
})

const depsEq: Eq<PlayerMessageDeps> = eq.fromEquals((x, y) => {
  if (x.type !== y.type) return false

  switch (x.type) {
    case 'Music':
      return musicEq.equals(x, y as Music)

    case 'Playlist':
      return playlistEq.equals(x, y as Playlist)
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

        onPlaylist: ({ files, playlistType, isPaused }) => ({
          audioStateType: state.type,
          isPaused,
          type: 'Playlist',
          playlistType,
          files,
        }),
      }),
    ),

  Eq: depsEq,
}

export { PlayerMessageDeps }
