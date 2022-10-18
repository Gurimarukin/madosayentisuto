import type { Message } from 'discord.js'
import { flow, pipe } from 'fp-ts/function'
import { lens } from 'monocle-ts'

import { createUnion } from '../../../shared/utils/createUnion'
import { List, Maybe, NonEmptyArray } from '../../../shared/utils/fp'

import type { GuildSendableChannel } from '../../utils/ChannelUtils'
import type { MyFile } from '../FileOrDir'
import type { Track } from './music/Track'

type NewAudioStateValue = typeof u.T

type NewAudioStateValueMusic = typeof u.Music.T
type NewAudioStateValueElevator = typeof u.Elevator.T

type MusicArgs = {
  readonly isPaused: boolean
  readonly currentTrack: Maybe<Track>
  readonly queue: List<Track>
  readonly messageChannel: GuildSendableChannel
  readonly message: Maybe<Message<true>>
  readonly pendingEvents: List<string> // because when we call /play, message.thread doesn't exist yet, so keep it here until we created thread
}

type ElevatorArgs = {
  readonly currentFile: Maybe<MyFile>
}

const u = createUnion({
  Music: (args: MusicArgs) => args,
  Elevator: (args: ElevatorArgs) => args,
})

type FoldArgs<A> = {
  readonly onMusic: (value: NewAudioStateValueMusic) => A
  readonly onElevator: (value: NewAudioStateValueElevator) => A
}

const NewAudioStateValue = {
  is: u.is,
  fold:
    <A>({ onMusic, onElevator }: FoldArgs<A>) =>
    (value: NewAudioStateValue): A => {
      switch (value.type) {
        case 'Music':
          return onMusic(value)
        case 'Elevator':
          return onElevator(value)
      }
    },
}

const musicIsPausedLens = pipe(lens.id<NewAudioStateValueMusic>(), lens.prop('isPaused'))
const musicCurrentTrackLens = pipe(lens.id<NewAudioStateValueMusic>(), lens.prop('currentTrack'))
const musicQueueLens = pipe(lens.id<NewAudioStateValueMusic>(), lens.prop('queue'))
const musicMessageChannelLens = pipe(
  lens.id<NewAudioStateValueMusic>(),
  lens.prop('messageChannel'),
)
const musicMessageLens = pipe(lens.id<NewAudioStateValueMusic>(), lens.prop('message'))
const musicPendingEventsLens = pipe(lens.id<NewAudioStateValueMusic>(), lens.prop('pendingEvents'))

const appendPendingEvent = (
  event: string,
): ((s: NewAudioStateValueMusic) => NewAudioStateValueMusic) =>
  pipe(musicPendingEventsLens, lens.modify(List.append(event)))

const NewAudioStateValueMusic = {
  empty: (messageChannel: GuildSendableChannel): NewAudioStateValueMusic =>
    u.Music({
      isPaused: false,
      currentTrack: Maybe.none,
      queue: List.empty,
      messageChannel,
      message: Maybe.none,
      pendingEvents: List.empty,
    }),

  queueTracks: (
    tracks: NonEmptyArray<Track>,
    event: string,
  ): ((value: NewAudioStateValueMusic) => NewAudioStateValueMusic) =>
    flow(
      pipe(musicQueueLens, lens.modify(NonEmptyArray.concat(tracks))),
      appendPendingEvent(event),
    ),

  emptyPendingEvents: musicPendingEventsLens.set(List.empty),
  appendPendingEvent,

  setIsPaused: musicIsPausedLens.set,
  setCurrentTrack: musicCurrentTrackLens.set,
  setQueue: musicQueueLens.set,
  setMessage: musicMessageLens.set,
}

const elevatorCurrentFileLens = pipe(
  lens.id<NewAudioStateValueElevator>(),
  lens.prop('currentFile'),
)

const NewAudioStateValueElevator = {
  setCurrentFile: elevatorCurrentFileLens.set,
}

export { NewAudioStateValue, NewAudioStateValueMusic, NewAudioStateValueElevator }
