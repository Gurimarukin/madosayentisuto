import { pipe } from 'fp-ts/function'
import * as C from 'io-ts/Codec'

import { List, Maybe, NonEmptyArray } from '../../utils/fp'
import { ChannelView } from '../ChannelView'
import { MessageView } from '../MessageView'
import { PlaylistType } from './PlaylistType'
import { Track } from './music/Track'

type AudioStateValueView = C.TypeOf<typeof codec>

type AudioStateValueViewMusic = C.TypeOf<typeof musicCodec>
type AudioStateValueViewPlaylist = C.TypeOf<typeof playlistCodec>

const commonCodec = C.struct({
  isPaused: C.boolean,
  messageChannel: ChannelView.codec,
  message: Maybe.codec(MessageView.codec),
  // pendingEvents: List.codec(C.string),
})

const musicCodec = pipe(
  C.struct({
    type: C.literal('Music'),
    currentTrack: Maybe.codec(Track.codec),
    queue: List.codec(Track.codec),
  }),
  C.intersect(commonCodec),
)

const playlistCodec = pipe(
  C.struct({
    type: C.literal('Playlist'),
    playlistType: PlaylistType.codec,
    files: NonEmptyArray.codec(C.string), // basename
  }),
  C.intersect(commonCodec),
)

const codec = C.sum('type')({
  Music: musicCodec,
  Playlist: playlistCodec,
})

const music = (
  currentTrack: Maybe<Track>,
  queue: List<Track>,
  isPaused: boolean,
  messageChannel: ChannelView,
  message: Maybe<MessageView>,
  // pendingEvents: List<string>,
): AudioStateValueViewMusic => ({
  type: 'Music',
  currentTrack,
  queue,
  isPaused,
  messageChannel,
  message,
  // pendingEvents,
})

const playlist = (
  playlistType: PlaylistType,
  files: NonEmptyArray<string>,
  isPaused: boolean,
  messageChannel: ChannelView,
  message: Maybe<MessageView>,
  // pendingEvents: List<string>,
): AudioStateValueViewPlaylist => ({
  type: 'Playlist',
  playlistType,
  files,
  isPaused,
  messageChannel,
  message,
  // pendingEvents,
})

const AudioStateValueView = { codec, music, playlist }

export { AudioStateValueView }
