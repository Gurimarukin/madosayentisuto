import type { Message } from 'discord.js'
import { flow, pipe } from 'fp-ts/function'
import { lens } from 'monocle-ts'

import { createUnion } from '../../../shared/utils/createUnion'
import { NonEmptyArray } from '../../../shared/utils/fp'
import { List } from '../../../shared/utils/fp'
import { Maybe } from '../../../shared/utils/fp'

import type { MyFile } from '../FileOrDir'
import type { Track } from './music/Track'

export type AudioStateType = typeof u.T

type AudioStateTypeMusic = typeof u.Music.T

type MusicArgs = {
  readonly isPaused: boolean
  readonly currentTrack: Maybe<Track>
  readonly queue: List<Track>
  readonly message: Maybe<Message<true>>
  readonly pendingEvent: Maybe<string> // because when we call /play, message.thread doesn't exist yet, so keep it here until we created thread
}

type ElevatorArgs = {
  readonly currentFile: Maybe<MyFile>
}

const u = createUnion({
  Music: (args: MusicArgs) => args,
  Elevator: (args: ElevatorArgs) => args,
})

const musicEmpty: AudioStateTypeMusic = u.Music({
  isPaused: false,
  currentTrack: Maybe.none,
  queue: List.empty,
  message: Maybe.none,
  pendingEvent: Maybe.none,
})

const getMusicOptional = (stateType: AudioStateType): Maybe<AudioStateTypeMusic> => {
  switch (stateType.type) {
    case 'Music':
      return Maybe.some(stateType)
    case 'Elevator':
      return Maybe.none
  }
}

const getCurrentTrack = flow(
  getMusicOptional,
  Maybe.chain(music => music.currentTrack),
)

const getQueue = flow(
  getMusicOptional,
  Maybe.map(music => music.queue),
)

const getMessage = flow(
  getMusicOptional,
  Maybe.chain(music => music.message),
)

const getPendingEvent: (stateType: AudioStateType) => Maybe<string> = flow(
  getMusicOptional,
  Maybe.chain(music => music.pendingEvent),
)

type ToMusic = (stateType: AudioStateType) => AudioStateTypeMusic

const modifyStateToMusic =
  (f: (s: AudioStateTypeMusic) => AudioStateTypeMusic): ToMusic =>
  stateType => {
    switch (stateType.type) {
      case 'Music':
        return f(stateType)
      case 'Elevator':
        // if it's Elevator, transform to Music
        return f(musicEmpty)
    }
  }

const musicIsPausedLens = pipe(lens.id<AudioStateTypeMusic>(), lens.prop('isPaused'))
const musicCurrentTrackLens = pipe(lens.id<AudioStateTypeMusic>(), lens.prop('currentTrack'))
const musicQueueLens = pipe(lens.id<AudioStateTypeMusic>(), lens.prop('queue'))
const musicMessageLens = pipe(lens.id<AudioStateTypeMusic>(), lens.prop('message'))
const musicPendingEventLens = pipe(lens.id<AudioStateTypeMusic>(), lens.prop('pendingEvent'))

const setPlaying: ToMusic = modifyStateToMusic(musicIsPausedLens.set(false))
const setPaused: ToMusic = modifyStateToMusic(musicIsPausedLens.set(true))

const setCurrentTrack = (currentTrack: Maybe<Track>): ToMusic =>
  modifyStateToMusic(musicCurrentTrackLens.set(currentTrack))

const setQueue = (queue: List<Track>): ToMusic => modifyStateToMusic(musicQueueLens.set(queue))

const setMessage = (message: Maybe<Message<true>>): ToMusic =>
  modifyStateToMusic(musicMessageLens.set(message))

const setPendingEvent = (pendingEvent: Maybe<string>): ToMusic =>
  modifyStateToMusic(musicPendingEventLens.set(pendingEvent))

const queueTracks = (tracks: NonEmptyArray<Track>): ToMusic =>
  modifyStateToMusic(pipe(musicQueueLens, lens.modify(NonEmptyArray.concat(tracks))))

export const AudioStateType = {
  is: u.is,

  musicEmpty,

  getCurrentTrack,
  getQueue,
  getMessage,
  getPendingEvent,

  setPlaying,
  setPaused,
  setCurrentTrack,
  setQueue,
  setMessage,
  setPendingEvent,
  queueTracks,
}
