import * as C from 'io-ts/Codec'

import { ChannelView } from '../ChannelView'
import { AudioStateValueView } from './AudioStateValueView'

type AudioStateView = C.TypeOf<typeof codec>
type AudioStateViewDisconnected = C.TypeOf<typeof disconnectedCodec>
type AudioStateViewConnecting = C.TypeOf<typeof connectingCodec>
type AudioStateViewConnected = C.TypeOf<typeof connectedCodec>

const disconnectedCodec = C.struct({
  type: C.literal('Disconnected'),
})

const connectingCodec = C.struct({
  type: C.literal('Connecting'),
  channel: ChannelView.codec,
  value: AudioStateValueView.codec,
})

const connectedCodec = C.struct({
  type: C.literal('Connected'),
  channel: ChannelView.codec,
  value: AudioStateValueView.codec,
})

const codec = C.sum('type')({
  Disconnected: disconnectedCodec,
  Connecting: connectingCodec,
  Connected: connectedCodec,
})

const disconnected: AudioStateViewDisconnected = { type: 'Disconnected' }

const connecting = (
  channel: ChannelView,
  value: AudioStateValueView,
): AudioStateViewConnecting => ({ type: 'Connecting', channel, value })

const connected = (channel: ChannelView, value: AudioStateValueView): AudioStateViewConnected => ({
  type: 'Connected',
  channel,
  value,
})

const AudioStateView = { codec, disconnected, connecting, connected }

export { AudioStateView }
