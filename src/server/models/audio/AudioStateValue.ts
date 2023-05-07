import type { Message } from 'discord.js'
import { boolean, eq, string } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'
import { lens } from 'monocle-ts'

import { MessageView } from '../../../shared/models/MessageView'
import { AudioStateValueView } from '../../../shared/models/audio/AudioStateValueView'
import { Track } from '../../../shared/models/audio/music/Track'
import { createUnion } from '../../../shared/utils/createUnion'
import { List, Maybe, NonEmptyArray } from '../../../shared/utils/fp'

import type { GuildSendableChannel } from '../../utils/ChannelUtils'
import { ChannelUtils } from '../../utils/ChannelUtils'
import { MessageUtils } from '../../utils/MessageUtils'
import { MyFile } from '../FileOrDir'

type AudioStateValue = typeof u.T

type AudioStateValueMusic = typeof u.Music.T
type AudioStateValueElevator = typeof u.Elevator.T

type MusicArgs = {
  isPaused: boolean
  currentTrack: Maybe<Track>
  queue: List<Track>
  messageChannel: GuildSendableChannel
  message: Maybe<Message<true>>
  pendingEvents: List<string> // because when we call /play, message.thread doesn't exist yet, so keep it here until we created thread
}

type ElevatorArgs = {
  playlist: NonEmptyArray<MyFile>
}

const u = createUnion({
  Music: (args: MusicArgs) => args,
  Elevator: (args: ElevatorArgs) => args,
})

type FoldArgs<A, B> = {
  onMusic: (value: AudioStateValueMusic) => A
  onElevator: (value: AudioStateValueElevator) => B
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

const Eq: eq.Eq<AudioStateValue> = eq.fromEquals((x, y) => {
  if (x.type !== y.type) return false
  switch (x.type) {
    case 'Music':
      return audioStateValueMusicEq.equals(x, y as AudioStateValueMusic)
    case 'Elevator':
      return audioStateValueElevatorEq.equals(x, y as AudioStateValueElevator)
  }
})

const eqIgnore: eq.Eq<unknown> = eq.fromEquals(() => true)

const audioStateValueMusicEq = eq.struct<AudioStateValueMusic>({
  type: eqIgnore,
  isPaused: boolean.Eq,
  currentTrack: Maybe.getEq(Track.Eq),
  queue: List.getEq(Track.Eq),
  messageChannel: ChannelUtils.EqById,
  message: Maybe.getEq(MessageUtils.EqById),
  pendingEvents: List.getEq(string.Eq),
})

const audioStateValueElevatorEq = eq.struct<AudioStateValueElevator>({
  type: eqIgnore,
  playlist: NonEmptyArray.getEq(MyFile.Eq),
})

const AudioStateValue = { is: u.is, fold, toView, Eq }

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
