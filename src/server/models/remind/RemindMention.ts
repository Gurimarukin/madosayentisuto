import type { DiscordUserId } from '../../../shared/models/DiscordUserId'

import { createUnion } from '../../utils/createUnion'
import type { RoleId } from '../RoleId'

export type RemindMention = typeof u.T

type RoleArgs = {
  readonly role: RoleId
}

type UserArgs = {
  readonly user: DiscordUserId
}

const u = createUnion({
  Role: (args: RoleArgs) => args,
  User: (args: UserArgs) => args,
})

export const RemindMention = { ...u }
