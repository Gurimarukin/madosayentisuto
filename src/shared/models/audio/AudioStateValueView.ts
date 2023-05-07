import { pipe } from 'fp-ts/function'
import * as C from 'io-ts/Codec'

import { List, Maybe, NonEmptyArray } from '../../utils/fp'
import { ChannelView } from '../ChannelView'
import { MessageView } from '../MessageView'
import { Track } from './music/Track'

type AudioStateValueView = C.TypeOf<typeof codec>

type AudioStateValueViewMusic = C.TypeOf<typeof musicCodec>
type AudioStateValueViewElevator = C.TypeOf<typeof elevatorCodec>

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

const elevatorCodec = pipe(
  C.struct({
    type: C.literal('Elevator'),
    playlist: NonEmptyArray.codec(C.string), // basename
  }),
  C.intersect(commonCodec),
)

const codec = C.sum('type')({
  Music: musicCodec,
  Elevator: elevatorCodec,
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

const elevator = (
  playlist: NonEmptyArray<string>,
  isPaused: boolean,
  messageChannel: ChannelView,
  message: Maybe<MessageView>,
  // pendingEvents: List<string>,
): AudioStateValueViewElevator => ({
  type: 'Elevator',
  playlist,
  isPaused,
  messageChannel,
  message,
  // pendingEvents,
})

const AudioStateValueView = { codec, music, elevator }

export { AudioStateValueView }
