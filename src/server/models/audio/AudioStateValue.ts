import type { Message } from 'discord.js'
import { flow, pipe } from 'fp-ts/function'
import { lens } from 'monocle-ts'

import { MessageView } from '../../../shared/models/MessageView'
import { AudioStateValueView } from '../../../shared/models/audio/AudioStateValueView'
import type { Track } from '../../../shared/models/audio/music/Track'
import { createUnion } from '../../../shared/utils/createUnion'
import { List, Maybe, NonEmptyArray } from '../../../shared/utils/fp'

import type { GuildSendableChannel } from '../../utils/ChannelUtils'
import { ChannelUtils } from '../../utils/ChannelUtils'
import type { MyFile } from '../FileOrDir'

type AudioStateValue = typeof u.T

type AudioStateValueMusic = typeof u.Music.T
type AudioStateValueElevator = typeof u.Elevator.T

type MusicArgs = {
  readonly isPaused: boolean
  readonly currentTrack: Maybe<Track>
  readonly queue: List<Track>
  readonly messageChannel: GuildSendableChannel
  readonly message: Maybe<Message<true>>
  readonly pendingEvents: List<string> // because when we call /play, message.thread doesn't exist yet, so keep it here until we created thread
}

type ElevatorArgs = {
  readonly playlist: NonEmptyArray<MyFile>
}

const u = createUnion({
  Music: (args: MusicArgs) => args,
  Elevator: (args: ElevatorArgs) => args,
})

type FoldArgs<A, B> = {
  readonly onMusic: (value: AudioStateValueMusic) => A
  readonly onElevator: (value: AudioStateValueElevator) => B
}

const fold =
  <A, B = A>({ onMusic, onElevator }: FoldArgs<A, B>) =>
  (value: AudioStateValue): A | B => {
    switch (value.type) {
      case 'Music':
        return onMusic(value)
      case 'Elevator':
        return onElevator(value)
    }
  }

const toView = fold<AudioStateValueView>({
  onMusic: s =>
    AudioStateValueView.music(
      s.isPaused,
      s.currentTrack,
      s.queue,
      ChannelUtils.toView(s.messageChannel),
      pipe(s.message, Maybe.map(MessageView.fromMessage)),
    ),
  onElevator: s =>
    AudioStateValueView.elevator(
      pipe(
        s.playlist,
        NonEmptyArray.map(f => f.basename),
        NonEmptyArray.rotate(1),
      ),
    ),
})

const AudioStateValue = { is: u.is, fold, toView }

const musicIsPausedLens = pipe(lens.id<AudioStateValueMusic>(), lens.prop('isPaused'))
const musicCurrentTrackLens = pipe(lens.id<AudioStateValueMusic>(), lens.prop('currentTrack'))
const musicQueueLens = pipe(lens.id<AudioStateValueMusic>(), lens.prop('queue'))
const musicMessageLens = pipe(lens.id<AudioStateValueMusic>(), lens.prop('message'))
const musicPendingEventsLens = pipe(lens.id<AudioStateValueMusic>(), lens.prop('pendingEvents'))

const appendPendingEvent = (event: string): ((s: AudioStateValueMusic) => AudioStateValueMusic) =>
  pipe(musicPendingEventsLens, lens.modify(List.append(event)))

const AudioStateValueMusic = {
  empty: (messageChannel: GuildSendableChannel): AudioStateValueMusic =>
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
  ): ((value: AudioStateValueMusic) => AudioStateValueMusic) =>
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

const elevatorPlaylistLens = pipe(lens.id<AudioStateValueElevator>(), lens.prop('playlist'))

const AudioStateValueElevator = {
  of: (playlist: NonEmptyArray<MyFile>): AudioStateValueElevator => u.Elevator({ playlist }),
  rotatePlaylist: pipe(elevatorPlaylistLens, lens.modify(NonEmptyArray.rotate(-1))),
}

export { AudioStateValue, AudioStateValueMusic, AudioStateValueElevator }
