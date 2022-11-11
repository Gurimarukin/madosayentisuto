import * as C from 'io-ts/Codec'

import { LogLevelWithoutTrace } from '../log/LogLevel'

type ServerToClientEventLog = C.TypeOf<typeof logCodec>

const logCodec = C.struct({
  type: C.literal('Log'),
  name: C.string,
  level: LogLevelWithoutTrace.codec,
  message: C.string,
})

type LogArgs = Omit<ServerToClientEventLog, 'type'>
const log = (args: LogArgs): ServerToClientEventLog => ({ type: 'Log', ...args })

type ServerToClientEventGuildStateUpdated = C.TypeOf<typeof guildStateUpdatedCodec>

const guildStateUpdatedCodec = C.struct({
  type: C.literal('GuildStateUpdated'),
})

const guildStateUpdated: ServerToClientEventGuildStateUpdated = { type: 'GuildStateUpdated' }

type ServerToClientEvent = C.TypeOf<typeof codec>

const codec = C.sum('type')({
  Log: logCodec,
  GuildStateUpdated: guildStateUpdatedCodec,
})

const ServerToClientEvent = {
  isLog: (event: ServerToClientEvent): event is ServerToClientEventLog => event.type === 'Log',
  isGuildStateUpdated: (
    event: ServerToClientEvent,
  ): event is ServerToClientEventGuildStateUpdated => event.type === 'GuildStateUpdated',
  log,
  guildStateUpdated,
  codec,
}

export { ServerToClientEvent, ServerToClientEventLog }
