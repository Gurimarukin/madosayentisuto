import type { APIRole, Role } from 'discord.js'
import { eq } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { RoleId } from '../models/RoleId'

const byId: eq.Eq<Role | APIRole> = pipe(RoleId.Eq, eq.contramap(RoleId.fromRole))

export const RoleUtils = { Eq: { byId } }
