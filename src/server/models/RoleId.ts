import type { APIRole } from 'discord-api-types/payloads/v9'
import type { Role } from 'discord.js'
import * as C from 'io-ts/Codec'
import type { Newtype } from 'newtype-ts'
import { iso } from 'newtype-ts'

import { fromNewtype } from '../../shared/utils/ioTsUtils'

export type RoleId = Newtype<{ readonly RoleId: unique symbol }, string>

const { wrap, unwrap } = iso<RoleId>()

const fromRole = (role: Role | APIRole): RoleId => wrap(role.id)

const codec = fromNewtype<RoleId>(C.string)

export const RoleId = { codec, fromRole, unwrap }
