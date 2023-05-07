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

type CommonArgs = {
  isPaused: boolean
  messageChannel: GuildSendableChannel
  message: Maybe<Message<true>>
  pendingEvents: List<string> // because when we call /play, message.thread doesn't exist yet, so keep it here until we created thread
}

type MusicArgs = {
  currentTrack: Maybe<Track>
  queue: List<Track>
} & CommonArgs

type ElevatorArgs = {
  playlist: NonEmptyArray<MyFile>
} & CommonArgs

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
      s.currentTrack,
      s.queue,
      s.isPaused,
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
      s.isPaused,
      ChannelUtils.toView(s.messageChannel),
      pipe(s.message, Maybe.map(MessageView.fromMessage)),
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
  playlist: NonEmptyArray.getEq(MyFile.Eq.byPath),
  isPaused: boolean.Eq,
  messageChannel: ChannelUtils.EqById,
  message: Maybe.getEq(MessageUtils.EqById),
  pendingEvents: List.getEq(string.Eq),
})

const isPausedLens = pipe(lens.id<AudioStateValue>(), lens.prop('isPaused'))
const pendingEventsLens = pipe(lens.id<AudioStateValue>(), lens.prop('pendingEvents'))
const messageLens = pipe(lens.id<AudioStateValue>(), lens.prop('message'))

const appendPendingEvent = (event: string): (<A extends AudioStateValue>(s: A) => A) =>
  pipe(pendingEventsLens, lens.modify(List.append(event))) as <A extends AudioStateValue>(s: A) => A

const AudioStateValue = {
  music: u.Music,
  elevator: u.Elevator,
  is: u.is,
  fold,
  toView,

  setIsPaused: isPausedLens.set as (isPaused: boolean) => <A extends AudioStateValue>(s: A) => A,
  emptyPendingEvents: pendingEventsLens.set(List.empty) as <A extends AudioStateValue>(s: A) => A,
  appendPendingEvent,
  setMessage: messageLens.set as (
    message: Maybe<Message<true>>,
  ) => <A extends AudioStateValue>(s: A) => A,

  Eq,
}

const musicCurrentTrackLens = pipe(lens.id<AudioStateValueMusic>(), lens.prop('currentTrack'))
const musicQueueLens = pipe(lens.id<AudioStateValueMusic>(), lens.prop('queue'))

const AudioStateValueMusic = {
  queueTracks: (
    tracks: NonEmptyArray<Track>,
    event: string,
  ): ((value: AudioStateValueMusic) => AudioStateValueMusic) =>
    flow(
      pipe(musicQueueLens, lens.modify(NonEmptyArray.concat(tracks))),
      appendPendingEvent(event),
    ),

  setCurrentTrack: musicCurrentTrackLens.set,
  setQueue: musicQueueLens.set,
}

const elevatorPlaylistLens = pipe(lens.id<AudioStateValueElevator>(), lens.prop('playlist'))

const AudioStateValueElevator = {
  rotatePlaylist: pipe(elevatorPlaylistLens, lens.modify(NonEmptyArray.rotate(-1))),
}

export { AudioStateValue, AudioStateValueMusic, AudioStateValueElevator }
