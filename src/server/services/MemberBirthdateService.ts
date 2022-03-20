import type { Dayjs } from 'dayjs'

import type { UserId } from '../../shared/models/guild/UserId'
import type { Future } from '../../shared/utils/fp'

import type { MemberBirthdatePersistence } from '../persistence/MemberBirthdatePersistence'

export type MemberBirthdateService = ReturnType<typeof MemberBirthdateService>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const MemberBirthdateService = ({
  listForMembers,
  remove,
  ...memberBirthdatePersistence
}: MemberBirthdatePersistence) => ({
  listForMembers,

  upsert: (id: UserId, birthdate: Dayjs): Future<boolean> =>
    memberBirthdatePersistence.upsert({ id, birthdate }),

  remove,
})
