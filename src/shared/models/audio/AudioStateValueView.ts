import * as C from 'io-ts/Codec'

import { List, Maybe, NonEmptyArray } from '../../utils/fp'
import { Track } from './music/Track'

type AudioStateValueView = C.TypeOf<typeof codec>

type AudioStateValueViewMusic = C.TypeOf<typeof musicCodec>
type AudioStateValueViewElevator = C.TypeOf<typeof elevatorCodec>

const musicCodec = C.struct({
  type: C.literal('Music'),
  isPaused: C.boolean,
  currentTrack: Maybe.codec(Track.codec),
  queue: List.codec(Track.codec),
  // messageChannel: ChannelView.codec,
  // message: Maybe.codec(MessageView.codec),
  // pendingEvents: List.codec(C.string),
})

const elevatorCodec = C.struct({
  type: C.literal('Elevator'),
  playlist: NonEmptyArray.codec(C.string), // basename
})

const codec = C.sum('type')({
  Music: musicCodec,
  Elevator: elevatorCodec,
})

const music = (
  isPaused: boolean,
  currentTrack: Maybe<Track>,
  queue: List<Track>,
  // messageChannel: ChannelView,
  // message: Maybe<MessageView>,
  // pendingEvents: List<string>,
): AudioStateValueViewMusic => ({
  type: 'Music',
  isPaused,
  currentTrack,
  queue,
  // messageChannel,
  // message,
  // pendingEvents,
})

const elevator = (playlist: NonEmptyArray<string>): AudioStateValueViewElevator => ({
  type: 'Elevator',
  playlist,
})

const AudioStateValueView = { codec, music, elevator }

export { AudioStateValueView }
