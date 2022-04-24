// import * as C from 'io-ts/Codec'

// import { DiscordUserId } from '../../../shared/models/DiscordUserId'

// import { RoleId } from '../RoleId'

// const roleCodec = C.struct({
//   type: C.literal('Role'),
//   role: RoleId.codec,
// })
// type Role = C.TypeOf<typeof roleCodec>

// const userCodec = C.struct({
//   type: C.literal('User'),
//   user: DiscordUserId.codec,
// })
// type User = C.TypeOf<typeof userCodec>

// const codec = C.sum('type')({
//   Role: roleCodec,
//   User: userCodec,
// })

// export type ReminderMention = C.TypeOf<typeof codec>

// export const ReminderMention = {
//   Role: (args: Omit<Role, 'type'>): Role => ({ type: 'Role', ...args }),
//   User: (args: Omit<User, 'type'>): User => ({ type: 'User', ...args }),
//   isUser: (m: ReminderMention): m is User => m.type === 'User',
//   codec,
// }
