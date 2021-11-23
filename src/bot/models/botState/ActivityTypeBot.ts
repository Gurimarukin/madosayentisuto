import { createEnum } from '../../utils/createEnum'

const enum_ = createEnum('PLAYING', 'STREAMING', 'LISTENING', 'WATCHING', 'COMPETING')
const { values, decoder, encoder, codec } = enum_

export type ActivityTypeBot = typeof enum_.T
export const ActivityTypeBot = { values, decoder, encoder, codec }
