import type { APIRole, Role } from 'discord.js'
import { eq, string } from 'fp-ts'
import { pipe } from 'fp-ts/function'
import * as C from 'io-ts/Codec'
import type { Newtype } from 'newtype-ts'
import { iso } from 'newtype-ts'

import { fromNewtype } from '../../shared/utils/ioTsUtils'

export type RoleId = Newtype<{ readonly RoleId: unique symbol }, string>

const { wrap, unwrap } = iso<RoleId>()

const fromRole = (role: Role | APIRole): RoleId => wrap(role.id)

const codec = fromNewtype<RoleId>(C.string)

const Eq: eq.Eq<RoleId> = pipe(string.Eq, eq.contramap(unwrap))

export const RoleId = { codec, fromRole, unwrap, Eq }
