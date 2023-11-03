import type { Message, TextChannel } from 'discord.js'
import { boolean, eq, string } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'
import { lens } from 'monocle-ts'

import { AudioStateValueView } from '../../../shared/models/audio/AudioStateValueView'
import type { PlaylistType } from '../../../shared/models/audio/PlaylistType'
import { Track } from '../../../shared/models/audio/music/Track'
import { createUnion } from '../../../shared/utils/createUnion'
import { List, Maybe, NonEmptyArray } from '../../../shared/utils/fp'

import { ChannelUtils } from '../../utils/ChannelUtils'
import { MessageUtils } from '../../utils/MessageUtils'
import { MyFile } from '../FileOrDir'

type AudioStateValue = typeof u.T

type AudioStateValueMusic = typeof u.Music.T
type AudioStateValuePlaylist = typeof u.Playlist.T

type CommonArgs = {
  isPaused: boolean
  messageChannel: TextChannel
  message: Maybe<Message<true>>
  pendingEvents: List<string> // because when we call /play, message.thread doesn't exist yet, so keep it here until we created thread
}

type MusicArgs = {
  currentTrack: Maybe<Track>
  queue: List<Track>
} & CommonArgs

type PlaylistArgs = {
  playlistType: PlaylistType
  files: NonEmptyArray<MyFile>
} & CommonArgs

const u = createUnion({
  Music: (args: MusicArgs) => args,
  Playlist: (args: PlaylistArgs) => args,
})

type FoldArgs<A, B> = {
  onMusic: (value: AudioStateValueMusic) => A
  onPlaylist: (value: AudioStateValuePlaylist) => B
}

const fold =
  <A, B = A>({ onMusic, onPlaylist }: FoldArgs<A, B>) =>
  (value: AudioStateValue): A | B => {
    switch (value.type) {
      case 'Music':
        return onMusic(value)
      case 'Playlist':
        return onPlaylist(value)
    }
  }

const toView = fold<AudioStateValueView>({
  onMusic: s =>
    AudioStateValueView.music(
      s.currentTrack,
      s.queue,
      s.isPaused,
      ChannelUtils.toView(s.messageChannel),
      pipe(s.message, Maybe.map(MessageUtils.toView)),
    ),
  onPlaylist: s =>
    AudioStateValueView.playlist(
      s.playlistType,
      pipe(
        s.files,
        NonEmptyArray.map(f => f.basename),
        NonEmptyArray.rotate(1),
      ),
      s.isPaused,
      ChannelUtils.toView(s.messageChannel),
      pipe(s.message, Maybe.map(MessageUtils.toView)),
    ),
})

const Eq: eq.Eq<AudioStateValue> = eq.fromEquals((x, y) => {
  if (x.type !== y.type) return false
  switch (x.type) {
    case 'Music':
      return audioStateValueMusicEq.equals(x, y as AudioStateValueMusic)
    case 'Playlist':
      return audioStateValuePlaylistEq.equals(x, y as AudioStateValuePlaylist)
  }
})

const eqIgnore: eq.Eq<unknown> = eq.fromEquals(() => true)

const audioStateValueMusicEq = eq.struct<AudioStateValueMusic>({
  type: eqIgnore,
  isPaused: boolean.Eq,
  currentTrack: Maybe.getEq(Track.Eq),
  queue: List.getEq(Track.Eq),
  messageChannel: ChannelUtils.Eq.byId,
  message: Maybe.getEq(MessageUtils.Eq.byId),
  pendingEvents: List.getEq(string.Eq),
})

const audioStateValuePlaylistEq = eq.struct<AudioStateValuePlaylist>({
  type: eqIgnore,
  playlistType: string.Eq,
  files: NonEmptyArray.getEq(MyFile.Eq.byPath),
  isPaused: boolean.Eq,
  messageChannel: ChannelUtils.Eq.byId,
  message: Maybe.getEq(MessageUtils.Eq.byId),
  pendingEvents: List.getEq(string.Eq),
})

const isPausedLens = pipe(lens.id<AudioStateValue>(), lens.prop('isPaused'))
const pendingEventsLens = pipe(lens.id<AudioStateValue>(), lens.prop('pendingEvents'))
const messageLens = pipe(lens.id<AudioStateValue>(), lens.prop('message'))

const appendPendingEvent = (event: string): (<A extends AudioStateValue>(s: A) => A) =>
  pipe(pendingEventsLens, lens.modify(List.append(event))) as <A extends AudioStateValue>(s: A) => A

const AudioStateValue = {
  music: u.Music,
  playlist: u.Playlist,
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

const playlistFilesLens = pipe(lens.id<AudioStateValuePlaylist>(), lens.prop('files'))

const AudioStateValuePlaylist = {
  rotatePlaylist: pipe(playlistFilesLens, lens.modify(NonEmptyArray.rotate(-1))),
}

export { AudioStateValue, AudioStateValueMusic, AudioStateValuePlaylist }
