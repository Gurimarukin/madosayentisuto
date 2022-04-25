import type { Role } from 'discord.js'
import * as C from 'io-ts/Codec'

const codec = C.struct({
  name: C.string,
  color: C.string,
})

export type RoleView = C.TypeOf<typeof codec>

const fromRole = (r: Role): RoleView => ({
  name: r.name,
  color: r.hexColor,
})

export const RoleView = { fromRole, codec }
