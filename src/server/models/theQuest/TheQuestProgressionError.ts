import * as D from 'io-ts/Decoder'

import { DiscordUserId } from '../../../shared/models/DiscordUserId'

type TheQuestProgressionError = D.TypeOf<typeof decoder>

const decoder = D.struct({
  user: DiscordUserId.codec,
  connectionName: D.string,
})

const TheQuestProgressionError = { decoder }

export { TheQuestProgressionError }
