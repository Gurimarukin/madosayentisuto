import type { Message } from 'discord.js'
import type { Endomorphism } from 'fp-ts/Endomorphism'
import { flow, pipe } from 'fp-ts/function'
import { lens } from 'monocle-ts'

import { createUnion } from '../../../shared/utils/createUnion'
import { NonEmptyArray } from '../../../shared/utils/fp'
import { List } from '../../../shared/utils/fp'
import { Maybe } from '../../../shared/utils/fp'

import type { GuildSendableChannel } from '../../utils/ChannelUtils'
import type { MyFile } from '../FileOrDir'
import type { Track } from './music/Track'

export type AudioStateType = typeof u.T

export type AudioStateTypeMusic = typeof u.Music.T
export type AudioStateTypeElevator = typeof u.Elevator.T

type MusicArgs = {
  readonly isPaused: boolean
  readonly currentTrack: Maybe<Track>
  readonly queue: List<Track>
  readonly messageChannel: Maybe<GuildSendableChannel>
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
  messageChannel: Maybe.none,
  message: Maybe.none,
  pendingEvent: Maybe.none,
})

const elevatorEmpty: AudioStateTypeElevator = u.Elevator({
  currentFile: Maybe.none,
})

const getMusicOptional = (stateType: AudioStateType): Maybe<AudioStateTypeMusic> => {
  switch (stateType.type) {
    case 'Music':
      return Maybe.some(stateType)
    case 'Elevator':
      return Maybe.none
  }
}

const getElevatorOptional = (stateType: AudioStateType): Maybe<AudioStateTypeElevator> => {
  switch (stateType.type) {
    case 'Music':
      return Maybe.none
    case 'Elevator':
      return Maybe.some(stateType)
  }
}

const getMusicCurrentTrack = flow(
  getMusicOptional,
  Maybe.chain(music => music.currentTrack),
)

const getMusicQueue = flow(
  getMusicOptional,
  Maybe.map(music => music.queue),
)

const getMusicMessage = flow(
  getMusicOptional,
  Maybe.chain(music => music.message),
)

const getMusicPendingEvent: (stateType: AudioStateType) => Maybe<string> = flow(
  getMusicOptional,
  Maybe.chain(music => music.pendingEvent),
)

type ToMusic = (stateType: AudioStateType) => AudioStateTypeMusic

const modifyToMusic =
  (f: Endomorphism<AudioStateTypeMusic>): ToMusic =>
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
const musicMessageChannelLens = pipe(lens.id<AudioStateTypeMusic>(), lens.prop('messageChannel'))
const musicMessageLens = pipe(lens.id<AudioStateTypeMusic>(), lens.prop('message'))
const musicPendingEventLens = pipe(lens.id<AudioStateTypeMusic>(), lens.prop('pendingEvent'))

const setMusicPlaying: ToMusic = modifyToMusic(musicIsPausedLens.set(false))
const setMusicPaused: ToMusic = modifyToMusic(musicIsPausedLens.set(true))

const setMusicCurrentTrack = (currentTrack: Maybe<Track>): ToMusic =>
  modifyToMusic(musicCurrentTrackLens.set(currentTrack))

const setMusicQueue = (queue: List<Track>): ToMusic => modifyToMusic(musicQueueLens.set(queue))

const setMusicMessageChannel = (messageChannel: Maybe<GuildSendableChannel>): ToMusic =>
  modifyToMusic(musicMessageChannelLens.set(messageChannel))

const setMusicMessage = (message: Maybe<Message<true>>): ToMusic =>
  modifyToMusic(musicMessageLens.set(message))

const setMusicPendingEvent = (pendingEvent: Maybe<string>): ToMusic =>
  modifyToMusic(musicPendingEventLens.set(pendingEvent))

const musicQueueTracks = (tracks: NonEmptyArray<Track>): ToMusic =>
  modifyToMusic(pipe(musicQueueLens, lens.modify(NonEmptyArray.concat(tracks))))

type ToElevator = (stateType: AudioStateType) => AudioStateTypeElevator

const modifyToElevator =
  (f: Endomorphism<AudioStateTypeElevator>): ToElevator =>
  stateType => {
    switch (stateType.type) {
      case 'Music':
        // if it's Music, transform to Elevator
        return f(elevatorEmpty)
      case 'Elevator':
        return f(stateType)
    }
  }

const elevatorCurrentFileLens = pipe(lens.id<AudioStateTypeElevator>(), lens.prop('currentFile'))

const elevatorCurrentFileSet = flow(elevatorCurrentFileLens.set, modifyToElevator)

export const AudioStateType = {
  is: u.is,

  musicEmpty,

  getMusicCurrentTrack,
  getMusicQueue,
  getMusicMessage,
  getMusicPendingEvent,

  setMusicPlaying,
  setMusicPaused,
  setMusicCurrentTrack,
  setMusicQueue,
  setMusicMessageChannel,
  setMusicMessage,
  setMusicPendingEvent,
  musicQueueTracks,

  Elevator: {
    empty: elevatorEmpty,
    currentFile: {
      get: flow(
        getElevatorOptional,
        Maybe.chain(elevator => elevator.currentFile),
      ),
      set: elevatorCurrentFileSet,
    },
  },
}
