import * as C from 'io-ts/Codec'

import { Maybe } from '../../utils/fp'
import { ChannelView } from '../ChannelView'
import { AudioStateView } from '../audio/AudioStateView'
import { CallsView } from './CallsView'
import { RoleView } from './RoleView'

const codec = C.struct({
  calls: Maybe.codec(CallsView.codec),
  defaultRole: Maybe.codec(RoleView.codec),
  itsFridayChannel: Maybe.codec(ChannelView.codec),
  birthdayChannel: Maybe.codec(ChannelView.codec),
  audioState: Maybe.codec(AudioStateView.codec),
})

export type GuildStateView = C.TypeOf<typeof codec>

export const GuildStateView = { codec }
